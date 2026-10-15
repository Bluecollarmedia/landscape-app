-- ============================================================================
-- Update 29 — Snow Mode activity log. Run in Supabase → SQL Editor after the
-- other snow updates.
-- Safe to run again, and worth re-running after any later snow update that
-- adds tables (or end that update with: select public.snow_attach_audit_all();).
--  • One append-only table, snow_activity_events: who did what, when, to which
--    record, with before/after values. Rows can't be edited or deleted, by
--    anyone, from the app or the SQL editor's normal roles.
--  • Logging happens in the database, not the app. Every snow_* table with a
--    company_id gets a trigger, so each insert, real change and delete
--    is logged whichever screen or function caused it. A table can also be
--    attached by hand: select public.snow_attach_audit('public.<t>', '<entity>');
--  • Snow functions that do something a row change can't describe (a
--    notification delivery result, a sign-in code rotated) call
--    public.snow_log_event(...) directly.
--  • Each event carries storm, route, visit, property, worker and service ids
--    picked from the row, so the Owner can filter by any of them. Those ids
--    are plain values, not foreign keys: removing a record never removes or
--    rewrites its history.
--  • Only the owner/admin can read the log. Workers and customers can't.
-- ============================================================================

create table if not exists public.snow_activity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  -- Who did it. Null when the system did it (a scheduled job, service key).
  actor_person_id uuid,
  -- What happened, as '<entity>.<verb>': storm.created, storm.dispatched,
  -- route.lead_changed, visit.reordered, visit.completed, skip_request.approved …
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity text not null,
  -- The record it happened to.
  record_table text,
  record_id uuid,
  -- Filter dimensions, copied from the record at the time of the event.
  storm_id uuid,
  route_id uuid,
  visit_id uuid,
  property_id uuid,
  worker_person_id uuid,
  service text,
  -- Changed fields only for updates; the whole row for creates and deletes.
  before jsonb,
  after jsonb,
  changed_fields text[] not null default '{}',
  note text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_snow_events_company_time on public.snow_activity_events (company_id, occurred_at desc, id desc);
create index if not exists idx_snow_events_storm on public.snow_activity_events (storm_id, occurred_at desc) where storm_id is not null;
create index if not exists idx_snow_events_route on public.snow_activity_events (route_id, occurred_at desc) where route_id is not null;
create index if not exists idx_snow_events_property on public.snow_activity_events (property_id, occurred_at desc) where property_id is not null;
create index if not exists idx_snow_events_worker on public.snow_activity_events (worker_person_id, occurred_at desc) where worker_person_id is not null;
create index if not exists idx_snow_events_actor on public.snow_activity_events (actor_person_id, occurred_at desc) where actor_person_id is not null;
create index if not exists idx_snow_events_record on public.snow_activity_events (record_table, record_id, occurred_at desc);

-- ── Append-only ─────────────────────────────────────────────────────────────
-- Deleting the whole company is the one thing allowed to remove events (the
-- company delete cascade). Everything else is refused.

create or replace function public.snow_events_append_only()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.companies where id = old.company_id) then
    return old;  -- the company itself is being deleted
  end if;
  raise exception 'The snow activity log can''t be changed or deleted.';
end;
$$;
drop trigger if exists snow_events_append_only on public.snow_activity_events;
create trigger snow_events_append_only before update or delete on public.snow_activity_events
  for each row execute function public.snow_events_append_only();

alter table public.snow_activity_events enable row level security;
revoke insert, update, delete, truncate on public.snow_activity_events from anon, authenticated;

drop policy if exists snow_activity_events_select on public.snow_activity_events;
create policy snow_activity_events_select on public.snow_activity_events for select
  using (public.is_staff(company_id));

-- ── Writing events ──────────────────────────────────────────────────────────

-- For snow functions to call directly. Not callable from the app.
create or replace function public.snow_log_event(
  p_company_id uuid,
  p_action text,
  p_record_table text default null,
  p_record_id uuid default null,
  p_storm_id uuid default null,
  p_route_id uuid default null,
  p_visit_id uuid default null,
  p_property_id uuid default null,
  p_worker_person_id uuid default null,
  p_service text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.snow_activity_events (
    company_id, actor_person_id, action, entity, record_table, record_id,
    storm_id, route_id, visit_id, property_id, worker_person_id, service,
    before, after, changed_fields, note, metadata
  ) values (
    p_company_id, public.my_person_id(), p_action, split_part(p_action, '.', 1), p_record_table, p_record_id,
    p_storm_id, p_route_id, p_visit_id, p_property_id, p_worker_person_id, p_service,
    p_before, p_after,
    coalesce(array(select jsonb_object_keys(coalesce(p_after, p_before, '{}'::jsonb))), '{}'),
    p_note, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.snow_log_event(uuid, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, jsonb) from public, anon, authenticated;

-- Row-change logger. Attached per table by snow_attach_audit().
--   TG_ARGV[0]  entity name used in actions ('storm', 'route', 'visit' …)
-- Picks filter ids from well-known column names; the record's own id fills
-- its own dimension (a storm row's id is its storm_id).
-- Verb for an update:
--   status changed           → the new status ('dispatched', 'completed' …),
--                              or 'reopened' when leaving 'ended'/'closed'
--   a *_status column changed → its new value ('approved', 'shared', 'delivered' …)
--   arrived_at set           → 'arrived'
--   clock-out time set       → 'clocked_out' (time entries)
--   route lead changed       → 'lead_changed'
--   assigned person changed  → 'reassigned'
--   only the order changed   → 'reordered'
--   anything else            → 'updated'
-- Updates that change nothing but updated_at aren't logged.
create or replace function public.snow_audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entity text := tg_argv[0];
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_before jsonb;
  v_after jsonb;
  v_changed text[] := '{}';
  v_verb text;
  v_key text;
  v_noise constant text[] := array['updated_at', 'created_at'];
  v_lead_cols constant text[] := array['lead_person_id', 'lead_worker_id'];
  v_assignee_cols constant text[] := array['assigned_person_id', 'worker_person_id', 'person_id'];
  v_order_cols constant text[] := array['sequence', 'position', 'sort_order', 'stop_order'];
  v_id_of text;
  v_company uuid;
  v_storm uuid;
  v_route uuid;
  v_visit uuid;
  v_property uuid;
  v_service text;
  v_prior record;
begin
  if tg_op = 'INSERT' then
    v_verb := 'created';
    v_after := v_new;
  elsif tg_op = 'DELETE' then
    v_verb := 'deleted';
    v_before := v_old;
  else
    for v_key in select jsonb_object_keys(v_new) loop
      if not (v_key = any (v_noise)) and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_changed := v_changed || v_key;
      end if;
    end loop;
    if cardinality(v_changed) = 0 then
      return null;
    end if;
    select jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      into v_before, v_after
      from unnest(v_changed) k;

    if 'status' = any (v_changed) then
      if (v_old ->> 'status') in ('ended', 'closed') and (v_new ->> 'status') not in ('ended', 'closed') then
        v_verb := 'reopened';
      else
        v_verb := lower(regexp_replace(coalesce(v_new ->> 'status', 'cleared'), '[^a-zA-Z_]+', '_', 'g'));
      end if;
    elsif (select k from unnest(v_changed) k where k like '%\_status' order by k limit 1) is not null then
      -- review_status, share_status, delivery_status …: the new value is the verb
      v_key := (select k from unnest(v_changed) k where k like '%\_status' order by k limit 1);
      v_verb := lower(regexp_replace(coalesce(v_new ->> v_key, 'cleared'), '[^a-zA-Z_]+', '_', 'g'));
    elsif 'arrived_at' = any (v_changed) and v_new ->> 'arrived_at' is not null then
      v_verb := 'arrived';
    elsif v_changed && array['clock_out_at', 'clocked_out_at', 'ended_at', 'end_at']
          and v_entity in ('time_entry', 'shift', 'time_record', 'clock_entry') then
      v_verb := 'clocked_out';
    elsif v_changed && v_lead_cols then
      v_verb := 'lead_changed';
    elsif v_changed && v_assignee_cols then
      v_verb := 'reassigned';
    elsif v_changed <@ v_order_cols then
      v_verb := 'reordered';
    else
      v_verb := 'updated';
    end if;
  end if;

  v_id_of := v_row ->> 'id';
  v_company := (v_row ->> 'company_id')::uuid;
  v_storm := (case when v_entity = 'storm' then v_id_of else v_row ->> 'storm_id' end)::uuid;
  v_route := (case when v_entity = 'route' then v_id_of else v_row ->> 'route_id' end)::uuid;
  v_visit := (case when v_entity = 'visit' then v_id_of else coalesce(v_row ->> 'visit_id', v_row ->> 'stop_id') end)::uuid;
  v_property := (case when v_entity = 'property' then v_id_of else v_row ->> 'property_id' end)::uuid;
  v_service := coalesce(v_row ->> 'service', v_row ->> 'service_type');

  -- A row that only points at its visit (media, a skip request) or its route
  -- inherits the rest from that record's earlier events, so it still shows
  -- up when the Owner filters by storm, route or property.
  if v_visit is not null and (v_storm is null or v_route is null or v_property is null or v_service is null) then
    select e.storm_id, e.route_id, e.property_id, e.service into v_prior
      from public.snow_activity_events e
     where e.company_id = v_company and e.visit_id = v_visit
     order by e.occurred_at desc limit 1;
    if found then
      v_storm := coalesce(v_storm, v_prior.storm_id);
      v_route := coalesce(v_route, v_prior.route_id);
      v_property := coalesce(v_property, v_prior.property_id);
      v_service := coalesce(v_service, v_prior.service);
    end if;
  end if;
  if v_route is not null and (v_storm is null or v_service is null) then
    select e.storm_id, e.route_id, e.property_id, e.service into v_prior
      from public.snow_activity_events e
     where e.company_id = v_company and e.route_id = v_route and e.entity = 'route'
     order by e.occurred_at desc limit 1;
    if found then
      v_storm := coalesce(v_storm, v_prior.storm_id);
      v_service := coalesce(v_service, v_prior.service);
    end if;
  end if;

  insert into public.snow_activity_events (
    company_id, actor_person_id, action, entity, record_table, record_id,
    storm_id, route_id, visit_id, property_id, worker_person_id, service,
    before, after, changed_fields
  ) values (
    v_company,
    public.my_person_id(),
    v_entity || '.' || v_verb,
    v_entity,
    tg_table_name,
    v_id_of::uuid,
    v_storm, v_route, v_visit, v_property,
    coalesce(v_row ->> 'lead_person_id', v_row ->> 'lead_worker_id', v_row ->> 'worker_person_id',
             v_row ->> 'assigned_person_id', v_row ->> 'person_id')::uuid,
    v_service,
    v_before,
    v_after,
    v_changed
  );
  return null;
end;
$$;

-- Opt a snow table into automatic logging. Safe to call again.
-- The table needs a company_id column; a uuid id (when it has one) becomes
-- the event's record_id.
create or replace function public.snow_attach_audit(p_table regclass, p_entity text)
returns void language plpgsql security definer set search_path = public as $$
declare v_trigger text := 'snow_audit';
begin
  if p_entity !~ '^[a-z_]+$' then
    raise exception 'Entity name must be lower_snake_case: %', p_entity;
  end if;
  execute format('drop trigger if exists %I on %s', v_trigger, p_table);
  execute format(
    'create trigger %I after insert or update or delete on %s for each row execute function public.snow_audit_row(%L)',
    v_trigger, p_table, p_entity
  );
end;
$$;
revoke all on function public.snow_attach_audit(regclass, text) from public, anon, authenticated;

-- Entity name for a snow table: snow_storms → storm, snow_route_stops → visit …
create or replace function public._snow_entity_for(p_table text)
returns text language sql immutable as $$
  select case
    when p_table in ('snow_visits', 'snow_route_visits', 'snow_route_stops', 'snow_stops') then 'visit'
    when p_table = 'snow_properties' then 'property'
    when p_table like 'snow\_%ies' then regexp_replace(substr(p_table, 6), 'ies$', 'y')
    when p_table like 'snow\_%ses' then regexp_replace(substr(p_table, 6), 'es$', '')
    when p_table like 'snow\_%s' then regexp_replace(substr(p_table, 6), 's$', '')
    else substr(p_table, 6)
  end
$$;

-- Attach logging to every snow_* table that has a company_id
-- (other append-only logs such as snow_access_log are left alone).
-- Tables are created by other snow updates, so this runs again at the end of
-- each of them (and is safe to run any time): new tables get picked up.
create or replace function public.snow_attach_audit_all()
returns int language plpgsql security definer set search_path = public as $$
declare t text; n int := 0;
begin
  for t in
    select c.relname from pg_class c
    join pg_namespace s on s.oid = c.relnamespace and s.nspname = 'public'
    where c.relkind in ('r', 'p') and c.relname like 'snow\_%' and c.relname <> 'snow_activity_events'
      and c.relname not like '%\_log' and c.relname not like '%\_events'  -- other logs are already history
      and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'company_id' and not a.attisdropped)
  loop
    perform public.snow_attach_audit(format('public.%I', t)::regclass, public._snow_entity_for(t));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.snow_attach_audit_all() from public, anon, authenticated;
select public.snow_attach_audit_all();

-- ── Reading events ──────────────────────────────────────────────────────────

-- Newest first, filtered, with actor and worker names. Owner/admin only.
-- The worker filter matches events they did or events about them.
-- Page with p_before_at/p_before_id from the last row of the previous page.
create or replace function public.snow_activity_feed(
  p_company_id uuid,
  p_storm_id uuid default null,
  p_route_id uuid default null,
  p_worker_person_id uuid default null,
  p_property_id uuid default null,
  p_action text default null,      -- 'visit.completed', or a whole entity: 'visit'
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 50
) returns table (
  id uuid,
  occurred_at timestamptz,
  action text,
  entity text,
  record_table text,
  record_id uuid,
  storm_id uuid,
  route_id uuid,
  visit_id uuid,
  property_id uuid,
  worker_person_id uuid,
  service text,
  before jsonb,
  after jsonb,
  changed_fields text[],
  note text,
  metadata jsonb,
  actor_person_id uuid,
  actor_name text,
  worker_name text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_company_id) then
    raise exception 'Only the owner can view the snow activity log.';
  end if;
  return query
  select e.id, e.occurred_at, e.action, e.entity, e.record_table, e.record_id,
         e.storm_id, e.route_id, e.visit_id, e.property_id, e.worker_person_id, e.service,
         e.before, e.after, e.changed_fields, e.note, e.metadata,
         e.actor_person_id,
         nullif(trim(a.first_name || ' ' || a.last_name), ''),
         nullif(trim(w.first_name || ' ' || w.last_name), '')
  from public.snow_activity_events e
  left join public.people a on a.id = e.actor_person_id
  left join public.people w on w.id = e.worker_person_id
  where e.company_id = p_company_id
    and (p_storm_id is null or e.storm_id = p_storm_id)
    and (p_route_id is null or e.route_id = p_route_id)
    and (p_property_id is null or e.property_id = p_property_id)
    and (p_worker_person_id is null or e.worker_person_id = p_worker_person_id or e.actor_person_id = p_worker_person_id)
    and (p_action is null or e.action = p_action or e.entity = p_action)
    and (p_before_at is null or (e.occurred_at, e.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by e.occurred_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
grant execute on function public.snow_activity_feed(uuid, uuid, uuid, uuid, uuid, text, timestamptz, uuid, int) to authenticated;

-- What the Owner can filter by: every storm, route, property, worker and
-- action that appears in the log, with the best name the log knows (the
-- record's latest name/title/address). Built from the log itself, so a
-- deleted storm or property still shows up for its history.
create or replace function public.snow_activity_filter_options(p_company_id uuid)
returns table (kind text, id uuid, action text, label text, event_count bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_company_id) then
    raise exception 'Only the owner can view the snow activity log.';
  end if;
  return query
  with ev as (
    select * from public.snow_activity_events e where e.company_id = p_company_id
  ),
  dims as (
    select 'storm'::text kind, ev.storm_id dim, ev.occurred_at from ev where ev.storm_id is not null
    union all select 'route', ev.route_id, ev.occurred_at from ev where ev.route_id is not null
    union all select 'property', ev.property_id, ev.occurred_at from ev where ev.property_id is not null
    union all select 'worker', ev.worker_person_id, ev.occurred_at from ev where ev.worker_person_id is not null
    union all select 'worker', ev.actor_person_id, ev.occurred_at from ev
      where ev.actor_person_id is not null and ev.actor_person_id is distinct from ev.worker_person_id
  ),
  grouped as (
    select d.kind, d.dim, count(*) n, max(d.occurred_at) last_at from dims d group by d.kind, d.dim
  )
  select g.kind, g.dim, null::text,
    case when g.kind = 'worker' then
      (select nullif(trim(p.first_name || ' ' || p.last_name), '') from public.people p where p.id = g.dim)
    else
      (select coalesce(x.after ->> 'name', x.after ->> 'title', x.after ->> 'label', x.after ->> 'address')
         from ev x
        where x.record_id = g.dim
          and coalesce(x.after ->> 'name', x.after ->> 'title', x.after ->> 'label', x.after ->> 'address') is not null
        order by x.occurred_at desc limit 1)
    end,
    g.n, g.last_at
  from grouped g
  union all
  select 'action', null::uuid, ev.action, null::text, count(*), max(ev.occurred_at)
  from ev group by ev.action
  order by 1, 6 desc;
end;
$$;
grant execute on function public.snow_activity_filter_options(uuid) to authenticated;

-- ── Live updates ────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'snow_activity_events'
  ) then
    alter publication supabase_realtime add table public.snow_activity_events;
  end if;
end $$;
