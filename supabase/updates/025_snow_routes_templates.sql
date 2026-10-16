-- ============================================================================
-- Update 25 — run once in Supabase → SQL Editor (safe to run again).
-- Run after 020 (snow access), 020b (snow foundation) and 022 (property
-- services).
--
--  • Owner route management for a storm, before and after dispatch:
--      snow_add_visit       add a stop anywhere in a route (also ahead of
--                           the lead's next stop), including a repeat pass
--                           at a property that is already on the route
--      snow_reorder_route   set the whole stop order at once (drag & drop)
--      snow_move_visit      move a not-started stop to another route
--      snow_remove_visit    take a not-started stop off and close the gap
--      snow_assign_lead     set or change a route's lead. Leading several
--                           routes is allowed; the function only reports
--                           the other routes the person already leads so
--                           the app can ask "Assign anyway?"
--  • Route templates: a saved service + stop order + lead + photo rule.
--      snow_save_route_as_template, snow_set_template_stops,
--      snow_apply_template (copies the template into a new route of a storm)
--    A route keeps a snapshot of the template version it was made from, and
--    its stops are real visits, so editing or deleting a template later never
--    changes a past or running storm.
--  • Owner/admin only. Leads and other workers can't call these, so a lead
--    can't change the order or skip ahead. Every change is written to the
--    activity log (visit.added/moved/removed and route.lead_* by the 020b
--    triggers; route.reordered, template.* and route.from_template here).
-- ============================================================================

-- ── Templates ───────────────────────────────────────────────────────────────

create table if not exists public.snow_route_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  service text not null check (service in ('plowing', 'shoveling', 'salting')),
  -- Suggested lead. Checked again when the template is used.
  lead_person_id uuid references public.people(id) on delete set null,
  media_required boolean not null default false,
  min_media integer not null default 1 check (min_media between 1 and 20),
  notes text,
  -- Goes up by one on every change to the template or its stops.
  version integer not null default 1,
  archived_at timestamptz,
  created_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_snow_route_templates_company on public.snow_route_templates (company_id, service);

-- The same property can be listed more than once (repeat passes).
create table if not exists public.snow_route_template_stops (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.snow_route_templates(id) on delete cascade,
  property_id uuid not null references public.snow_properties(id) on delete cascade,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  constraint snow_route_template_stops_position unique (template_id, position) deferrable initially deferred
);
create index if not exists idx_snow_template_stops_template on public.snow_route_template_stops (template_id, position);

-- Where a route came from. The snapshot is the template exactly as it was
-- used; the link is cleared if the template is deleted, the snapshot stays.
alter table public.snow_routes add column if not exists template_id uuid references public.snow_route_templates(id) on delete set null;
alter table public.snow_routes add column if not exists template_version integer;
alter table public.snow_routes add column if not exists template_snapshot jsonb;
-- Lets the app retry "use template" after a network drop without two routes.
alter table public.snow_routes add column if not exists client_request_id uuid unique;

drop trigger if exists snow_route_templates_updated_at on public.snow_route_templates;
create trigger snow_route_templates_updated_at before update on public.snow_route_templates
  for each row execute function public.set_updated_at();

-- Template: company stays put, service can't change once it has stops
-- (they were picked for that service), version goes up on every edit.
create or replace function public.snow_template_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.company_id := old.company_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.service <> old.service
       and exists (select 1 from public.snow_route_template_stops where template_id = old.id) then
      raise exception 'Remove the stops before changing the template''s service.';
    end if;
    if (to_jsonb(new) - 'updated_at' - 'version') is distinct from (to_jsonb(old) - 'updated_at' - 'version')
       or current_setting('snow.template_stops_changed', true) = new.id::text then
      new.version := old.version + 1;
    else
      new.version := old.version;
    end if;
  else
    new.version := 1;
    new.created_by := coalesce(new.created_by, public.my_person_id());
  end if;
  if new.lead_person_id is not null
     and (tg_op = 'INSERT' or new.lead_person_id is distinct from old.lead_person_id)
     and not public.snow_person_has_service(new.company_id, new.lead_person_id, new.service) then
    raise exception 'This person isn''t on the snow team for %.', new.service;
  end if;
  return new;
end $$;
drop trigger if exists snow_route_templates_rules on public.snow_route_templates;
create trigger snow_route_templates_rules before insert or update on public.snow_route_templates
  for each row execute function public.snow_template_rules();

-- Stops take the template's company; the property must be in the company.
create or replace function public.snow_template_stop_fill()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select company_id into cid from public.snow_route_templates where id = new.template_id;
  if cid is null then raise exception 'Template not found.'; end if;
  if not exists (select 1 from public.snow_properties where id = new.property_id and company_id = cid) then
    raise exception 'Property not found.';
  end if;
  new.company_id := cid;
  return new;
end $$;
drop trigger if exists snow_template_stops_fill on public.snow_route_template_stops;
create trigger snow_template_stops_fill before insert or update on public.snow_route_template_stops
  for each row execute function public.snow_template_stop_fill();

-- ── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public._snow_require_staff(cid uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if cid is null or not public.is_staff(cid) then
    raise exception 'Only the owner or an admin can change snow routes.';
  end if;
end $$;

-- The route with its storm, locked for the rest of the transaction so two
-- owners editing the same route at once take turns.
create or replace function public._snow_route_for_edit(
  p_route_id uuid, out id uuid, out company_id uuid, out storm_id uuid, out service text, out storm_status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare cancelled timestamptz;
begin
  select rt.id, rt.company_id, rt.storm_id, rt.service, rt.cancelled_at, st.status
    into id, company_id, storm_id, service, cancelled, storm_status
    from public.snow_routes rt join public.snow_storms st on st.id = rt.storm_id
   where rt.id = p_route_id
   for update of rt;
  if id is null then raise exception 'Route not found.'; end if;
  perform public._snow_require_staff(company_id);
  if storm_status = 'ended' then raise exception 'This storm has ended. Reopen it to change routes.'; end if;
  if cancelled is not null then raise exception 'This route was cancelled.'; end if;
end $$;

-- Close gaps: positions become 1..n in their current order.
create or replace function public._snow_compact_route(p_route_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.snow_visits v set position = o.rn
    from (select id, row_number() over (order by position, created_at) as rn
            from public.snow_visits where route_id = p_route_id) o
   where v.id = o.id and v.position <> o.rn;
end $$;

-- ── Add a stop ──────────────────────────────────────────────────────────────
-- p_position: 1 = first stop. Null or past the end = last. Later stops move
-- down one. The same property may already be on the route (repeat pass).
-- Retrying with the same p_client_request_id returns the first visit.
create or replace function public.snow_add_visit(
  p_route_id uuid, p_property_id uuid, p_position integer default null, p_client_request_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer;
  pos integer;
  vid uuid;
begin
  if p_client_request_id is not null then
    select id into vid from public.snow_visits where client_request_id = p_client_request_id;
    if vid is not null then return vid; end if;
  end if;
  select * into r from public._snow_route_for_edit(p_route_id);
  select count(*) into n from public.snow_visits where route_id = p_route_id;
  pos := least(greatest(coalesce(p_position, n + 1), 1), n + 1);
  perform public._snow_compact_route(p_route_id);
  update public.snow_visits set position = position + 1 where route_id = p_route_id and position >= pos;
  insert into public.snow_visits (route_id, property_id, position, client_request_id)
  values (p_route_id, p_property_id, pos, p_client_request_id)
  returning id into vid;
  return vid;
end $$;

-- ── Reorder a route ─────────────────────────────────────────────────────────
-- p_visit_ids is the route's full stop list in the new order. Finished stops
-- can be anywhere; the lead always works the first unfinished stop.
create or replace function public.snow_reorder_route(p_route_id uuid, p_visit_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  before_ids uuid[];
begin
  select * into r from public._snow_route_for_edit(p_route_id);
  select array_agg(id order by position, created_at) into before_ids from public.snow_visits where route_id = p_route_id;
  if coalesce(array_length(p_visit_ids, 1), 0) <> coalesce(array_length(before_ids, 1), 0)
     or (select count(distinct x) from unnest(p_visit_ids) x) <> coalesce(array_length(before_ids, 1), 0)
     or exists (select 1 from unnest(p_visit_ids) x where x <> all (before_ids)) then
    raise exception 'The route changed while you were editing. Refresh and try again.';
  end if;
  if before_ids = p_visit_ids then return; end if;
  update public.snow_visits v set position = o.pos
    from unnest(p_visit_ids) with ordinality as o(id, pos)
   where v.id = o.id and v.position <> o.pos;
  perform public.snow_log_event(r.company_id, 'route.reordered', 'route', r.id, r.storm_id, r.id,
    null, null, null, r.service, jsonb_build_object('order', to_jsonb(before_ids)), jsonb_build_object('order', to_jsonb(p_visit_ids)));
end $$;

-- ── Move a stop to another route of the same storm ──────────────────────────
create or replace function public.snow_move_visit(p_visit_id uuid, p_to_route_id uuid, p_position integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v record;
  r_from record;
  r_to record;
  n integer;
  pos integer;
begin
  select id, route_id, status into v from public.snow_visits where id = p_visit_id;
  if v.id is null then raise exception 'Stop not found.'; end if;
  if v.route_id = p_to_route_id then
    raise exception 'Use reorder to move a stop within its route.';
  end if;
  -- Lock both routes in a fixed order so two moves can't deadlock.
  if v.route_id < p_to_route_id then
    select * into r_from from public._snow_route_for_edit(v.route_id);
    select * into r_to from public._snow_route_for_edit(p_to_route_id);
  else
    select * into r_to from public._snow_route_for_edit(p_to_route_id);
    select * into r_from from public._snow_route_for_edit(v.route_id);
  end if;
  if r_to.storm_id <> r_from.storm_id then raise exception 'A stop can only move to a route in the same storm.'; end if;
  if v.status <> 'pending' then raise exception 'Only a stop that hasn''t been started can move to another route.'; end if;
  select count(*) into n from public.snow_visits where route_id = p_to_route_id;
  pos := least(greatest(coalesce(p_position, n + 1), 1), n + 1);
  perform public._snow_compact_route(p_to_route_id);
  update public.snow_visits set position = position + 1 where route_id = p_to_route_id and position >= pos;
  update public.snow_visits set route_id = p_to_route_id, position = pos where id = p_visit_id;
  perform public._snow_compact_route(r_from.id);
end $$;

-- ── Remove a stop that hasn't been started ──────────────────────────────────
create or replace function public.snow_remove_visit(p_visit_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v record;
  r record;
begin
  select id, route_id, status into v from public.snow_visits where id = p_visit_id;
  if v.id is null then return; end if; -- already removed (retry)
  select * into r from public._snow_route_for_edit(v.route_id);
  if v.status <> 'pending' then raise exception 'This stop has recorded work and can''t be removed.'; end if;
  delete from public.snow_visits where id = p_visit_id;
  perform public._snow_compact_route(r.id);
end $$;

-- ── Lead assignment ─────────────────────────────────────────────────────────
-- Other routes the person currently leads in storms that haven't ended.
create or replace function public.snow_lead_conflicts(p_person_id uuid, p_except_route_id uuid default null)
returns table (route_id uuid, route_name text, storm_id uuid, storm_name text, storm_status text, service text, stops_left integer)
language sql stable security definer set search_path = public as $$
  select rt.id, rt.name, st.id, st.name, st.status, rt.service,
         (select count(*)::int from public.snow_visits v where v.route_id = rt.id and v.status in ('pending', 'arrived'))
    from public.snow_routes rt join public.snow_storms st on st.id = rt.storm_id
   where rt.lead_person_id = p_person_id
     and rt.cancelled_at is null
     and st.status <> 'ended'
     and (p_except_route_id is null or rt.id <> p_except_route_id)
     and public.is_staff(rt.company_id)
   order by st.created_at, rt.position, rt.name
$$;

-- Set or change (or clear, with null) a route's lead. When the person already
-- leads other open routes and p_confirm is false, nothing changes and the
-- result lists them ({"assigned": false, "conflicts": [...]}); call again with
-- p_confirm = true to go ahead. There is no limit on routes per lead.
create or replace function public.snow_assign_lead(p_route_id uuid, p_person_id uuid, p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  current_lead uuid;
  conflicts jsonb;
begin
  select * into r from public._snow_route_for_edit(p_route_id);
  select lead_person_id into current_lead from public.snow_routes where id = p_route_id;
  if current_lead is not distinct from p_person_id then
    return jsonb_build_object('assigned', true, 'conflicts', '[]'::jsonb);
  end if;
  if p_person_id is not null then
    select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into conflicts
      from public.snow_lead_conflicts(p_person_id, p_route_id) c;
    if jsonb_array_length(conflicts) > 0 and not coalesce(p_confirm, false) then
      return jsonb_build_object('assigned', false, 'conflicts', conflicts);
    end if;
  end if;
  -- The 020b triggers check the person holds the service, end the old lead's
  -- assignment, open the new one and log both.
  update public.snow_routes set lead_person_id = p_person_id where id = p_route_id;
  return jsonb_build_object('assigned', true, 'conflicts', coalesce(conflicts, '[]'::jsonb));
end $$;

-- ── Templates ───────────────────────────────────────────────────────────────

-- Replace a template's stops with this list (repeats allowed).
create or replace function public.snow_set_template_stops(p_template_id uuid, p_property_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select id, company_id, service, version into t from public.snow_route_templates where id = p_template_id for update;
  if t.id is null then raise exception 'Template not found.'; end if;
  perform public._snow_require_staff(t.company_id);
  if exists (select 1 from unnest(coalesce(p_property_ids, '{}')) x
              where not exists (select 1 from public.snow_properties p where p.id = x and p.company_id = t.company_id)) then
    raise exception 'Property not found.';
  end if;
  if (select coalesce(array_agg(property_id order by position), '{}') from public.snow_route_template_stops where template_id = t.id)
     = coalesce(p_property_ids, '{}') then
    return;
  end if;
  -- One new template version for the whole change.
  perform set_config('snow.template_stops_changed', t.id::text, true);
  update public.snow_route_templates set updated_at = now() where id = t.id;
  perform set_config('snow.template_stops_changed', '', true);
  delete from public.snow_route_template_stops where template_id = t.id;
  insert into public.snow_route_template_stops (template_id, property_id, position)
  select t.id, x, o from unnest(coalesce(p_property_ids, '{}')) with ordinality as u(x, o);
  perform public.snow_log_event(t.company_id, 'template.stops_changed', 'route_template', t.id,
    null, null, null, null, null, t.service, null, jsonb_build_object('property_ids', to_jsonb(coalesce(p_property_ids, '{}'))));
end $$;

-- Save a route's current stop order, lead and photo rule as a new template.
create or replace function public.snow_save_route_as_template(p_route_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r record;
  tid uuid;
begin
  select id, company_id, storm_id, service, lead_person_id, media_required, min_media into r
    from public.snow_routes where id = p_route_id;
  if r.id is null then raise exception 'Route not found.'; end if;
  perform public._snow_require_staff(r.company_id);
  if coalesce(trim(p_name), '') = '' then raise exception 'Give the template a name.'; end if;
  insert into public.snow_route_templates (company_id, name, service, lead_person_id, media_required, min_media)
  values (r.company_id, trim(p_name), r.service,
          case when r.lead_person_id is not null and public.snow_person_has_service(r.company_id, r.lead_person_id, r.service)
               then r.lead_person_id end,
          r.media_required, r.min_media)
  returning id into tid;
  insert into public.snow_route_template_stops (template_id, property_id, position)
  select tid, property_id, row_number() over (order by position, created_at)
    from public.snow_visits where route_id = r.id;
  perform public.snow_log_event(r.company_id, 'template.created', 'route_template', tid,
    r.storm_id, r.id, null, null, null, r.service, null, jsonb_build_object('name', trim(p_name), 'from_route', r.id));
  return tid;
end $$;

-- Make a new route in a storm from a template. Stops whose property is
-- inactive or no longer gets the service are left out and listed in the
-- result, and so is a saved lead who isn't on the team for it any more.
-- Result: {"route_id", "added", "skipped": [{property_id, name, reason}], "lead_dropped"}.
create or replace function public.snow_apply_template(
  p_template_id uuid, p_storm_id uuid, p_route_name text default null, p_client_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record;
  st record;
  rid uuid;
  lead uuid;
  snap jsonb;
  s record;
  added integer := 0;
  skipped jsonb := '[]'::jsonb;
  next_pos integer;
begin
  if p_client_request_id is not null then
    select id into rid from public.snow_routes where client_request_id = p_client_request_id;
    if rid is not null then
      return jsonb_build_object('route_id', rid, 'added',
        (select count(*) from public.snow_visits where route_id = rid), 'skipped', '[]'::jsonb, 'lead_dropped', false, 'repeated', true);
    end if;
  end if;
  select * into t from public.snow_route_templates where id = p_template_id;
  if t.id is null then raise exception 'Template not found.'; end if;
  perform public._snow_require_staff(t.company_id);
  select id, company_id, service, status into st from public.snow_storms where id = p_storm_id for update;
  if st.id is null or st.company_id <> t.company_id then raise exception 'Storm not found.'; end if;
  if st.status = 'ended' then raise exception 'This storm has ended. Reopen it to add routes.'; end if;
  if st.service <> t.service then
    raise exception 'This template is for %, but the storm is for %.', t.service, st.service;
  end if;

  lead := case when t.lead_person_id is not null and public.snow_person_has_service(t.company_id, t.lead_person_id, t.service)
               then t.lead_person_id end;
  snap := to_jsonb(t) || jsonb_build_object('stops',
    coalesce((select jsonb_agg(jsonb_build_object('property_id', property_id, 'position', position) order by position)
                from public.snow_route_template_stops where template_id = t.id), '[]'::jsonb));

  insert into public.snow_routes (company_id, storm_id, service, name, position, lead_person_id, media_required, min_media,
                                  template_id, template_version, template_snapshot, client_request_id, created_by)
  values (t.company_id, st.id, st.service, coalesce(nullif(trim(p_route_name), ''), t.name),
          (select coalesce(max(position), 0) + 1 from public.snow_routes where storm_id = st.id),
          lead, t.media_required, t.min_media, t.id, t.version, snap, p_client_request_id, public.my_person_id())
  returning id into rid;

  next_pos := 1;
  for s in
    select ts.property_id, ts.position, p.name, p.status,
           exists (select 1 from public.snow_property_services ps
                    where ps.property_id = ts.property_id and ps.service = t.service and ps.is_active) as has_service
      from public.snow_route_template_stops ts join public.snow_properties p on p.id = ts.property_id
     where ts.template_id = t.id
     order by ts.position
  loop
    if s.status <> 'active' then
      skipped := skipped || jsonb_build_object('property_id', s.property_id, 'name', s.name, 'reason', 'inactive');
    elsif not s.has_service then
      skipped := skipped || jsonb_build_object('property_id', s.property_id, 'name', s.name, 'reason', 'no_service');
    else
      insert into public.snow_visits (route_id, property_id, position) values (rid, s.property_id, next_pos);
      next_pos := next_pos + 1;
      added := added + 1;
    end if;
  end loop;

  perform public.snow_log_event(t.company_id, 'route.from_template', 'route', rid, st.id, rid, null, null, lead, t.service,
    null, jsonb_build_object('template_id', t.id, 'template_version', t.version, 'added', added, 'skipped', skipped,
                             'lead_dropped', t.lead_person_id is not null and lead is null));
  return jsonb_build_object('route_id', rid, 'added', added, 'skipped', skipped,
                            'lead_dropped', t.lead_person_id is not null and lead is null);
end $$;

-- ── Access rules ────────────────────────────────────────────────────────────
--  Templates: owner/admin only. Everyone else sees nothing. Template stops
--  are read directly and written through snow_set_template_stops.

alter table public.snow_route_templates enable row level security;
alter table public.snow_route_template_stops enable row level security;
drop policy if exists snow_route_templates_staff on public.snow_route_templates;
create policy snow_route_templates_staff on public.snow_route_templates
  for all using (public.is_staff(company_id)) with check (public.is_staff(company_id));
drop policy if exists snow_route_template_stops_staff on public.snow_route_template_stops;
create policy snow_route_template_stops_staff on public.snow_route_template_stops
  for select using (public.is_staff(company_id));
-- Stops change only through snow_set_template_stops (one version per change).

-- Internal helpers aren't callable from the app.
revoke all on function public._snow_require_staff(uuid) from public, anon, authenticated;
revoke all on function public._snow_route_for_edit(uuid) from public, anon, authenticated;
revoke all on function public._snow_compact_route(uuid) from public, anon, authenticated;
revoke all on function public.snow_template_rules() from public, anon, authenticated;
revoke all on function public.snow_template_stop_fill() from public, anon, authenticated;

grant execute on function public.snow_add_visit(uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.snow_reorder_route(uuid, uuid[]) to authenticated;
grant execute on function public.snow_move_visit(uuid, uuid, integer) to authenticated;
grant execute on function public.snow_remove_visit(uuid) to authenticated;
grant execute on function public.snow_lead_conflicts(uuid, uuid) to authenticated;
grant execute on function public.snow_assign_lead(uuid, uuid, boolean) to authenticated;
grant execute on function public.snow_set_template_stops(uuid, uuid[]) to authenticated;
grant execute on function public.snow_save_route_as_template(uuid, text) to authenticated;
grant execute on function public.snow_apply_template(uuid, uuid, text, uuid) to authenticated;

-- ── Live updates ────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['snow_route_templates', 'snow_route_template_stops'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
