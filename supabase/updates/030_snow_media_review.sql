-- ============================================================================
-- Update 30 — run once in Supabase → SQL Editor, AFTER updates 20, 20b and 22.
-- Safe to run again.
--  Snow completion media: Owner review, explicit sharing, and the customer's
--  snow history.
--
--  Reference media → visit → completion media → Owner review → sharing.
--  • Every photo/video has its own review status: unreviewed (default),
--    approved (picked for the customer) or removed (left out). Removing never
--    deletes the upload; the row and file stay for history.
--  • Sharing is a separate, explicit step, item by item. Each share (and any
--    later "stop sharing") is kept in snow_media_shares. Uploading, completing
--    a visit, approving, or reopening a storm never shares anything.
--  • Only an approved item on a completed visit can be shared. Removing a
--    shared item stops sharing it.
--  • The Owner can add media to a visit (it starts unreviewed like any other).
--  • Review/share columns can only be changed through the functions below,
--    so every change is logged in the snow activity log.
--  • Customers never read snow tables directly. snow_customer_history()
--    returns only completed visits and the items shared with them, for the
--    properties they are a linked contact on: no route, lead, crew, pending
--    work, skip requests, notes or unshared media.
--  • Files: completion uploads go to the private "snow-media" bucket (made in
--    update 22) under {company_id}/completion/{visit_id}/{random}.{ext}. A
--    customer can open a file only while it is shared with them.
-- ============================================================================

-- ── Per-item review status ──────────────────────────────────────────────────

alter table public.snow_completion_media
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists reviewed_by uuid references public.people(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  -- Current share state (history is in snow_media_shares).
  add column if not exists shared_by uuid references public.people(id) on delete set null,
  add column if not exists shared_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'snow_completion_media_review_status_check') then
    alter table public.snow_completion_media add constraint snow_completion_media_review_status_check
      check (review_status in ('unreviewed', 'approved', 'removed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'snow_completion_media_shared_needs_approved') then
    alter table public.snow_completion_media add constraint snow_completion_media_shared_needs_approved
      check (shared_at is null or review_status = 'approved');
  end if;
end $$;

create index if not exists idx_snow_completion_media_review
  on public.snow_completion_media (company_id, review_status);
create index if not exists idx_snow_completion_media_shared
  on public.snow_completion_media (property_id, shared_at) where shared_at is not null;

-- ── Share history ───────────────────────────────────────────────────────────

-- One row each time an item is shared. "Stop sharing" fills revoked_at; the
-- row stays. At most one open share per item.
create table if not exists public.snow_media_shares (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  media_id uuid not null references public.snow_completion_media(id) on delete restrict,
  visit_id uuid not null references public.snow_visits(id) on delete restrict,
  property_id uuid not null references public.snow_properties(id) on delete restrict,
  shared_by uuid references public.people(id) on delete set null,
  shared_at timestamptz not null default now(),
  note text,
  revoked_by uuid references public.people(id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text
);
create unique index if not exists uq_snow_media_shares_open on public.snow_media_shares (media_id) where revoked_at is null;
create index if not exists idx_snow_media_shares_property on public.snow_media_shares (property_id, shared_at desc);

-- Share rows are written only by the functions below and never deleted.
-- The only allowed change is closing an open share.
create or replace function public._snow_media_shares_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Sharing history can''t be deleted.';
  end if;
  if coalesce(current_setting('snow.media_review', true), '') <> 'on' then
    raise exception 'Use the review and share actions to change sharing.';
  end if;
  if tg_op = 'UPDATE' then
    if old.revoked_at is not null
       or (new.id, new.company_id, new.media_id, new.visit_id, new.property_id, new.shared_by, new.shared_at, new.note)
          is distinct from (old.id, old.company_id, old.media_id, old.visit_id, old.property_id, old.shared_by, old.shared_at, old.note) then
      raise exception 'Sharing history can''t be changed.';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists snow_media_shares_guard on public.snow_media_shares;
create trigger snow_media_shares_guard before insert or update or delete on public.snow_media_shares
  for each row execute function public._snow_media_shares_guard();

-- ── Guard: review/share columns change only through the functions ───────────

create or replace function public._snow_media_review_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('snow.media_review', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- New uploads (crew or Owner) always start unreviewed and unshared.
    new.review_status := 'unreviewed';
    new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
    new.shared_by := null; new.shared_at := null;
    return new;
  end if;
  if (new.review_status, new.reviewed_by, new.reviewed_at, new.review_note, new.shared_by, new.shared_at)
     is distinct from (old.review_status, old.reviewed_by, old.reviewed_at, old.review_note, old.shared_by, old.shared_at) then
    raise exception 'Use the review and share actions to change what the customer sees.';
  end if;
  return new;
end $$;
drop trigger if exists snow_completion_media_review_guard on public.snow_completion_media;
create trigger snow_completion_media_review_guard before insert or update on public.snow_completion_media
  for each row execute function public._snow_media_review_guard();

-- ── Who may see a shared item ───────────────────────────────────────────────

-- True when the caller is an active customer of the company, a linked contact
-- of the item's property, and the item is approved, currently shared and on a
-- completed visit.
create or replace function public.snow_customer_can_see_media(p_media_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.snow_completion_media m
    join public.snow_visits v on v.id = m.visit_id
    where m.id = p_media_id
      and m.review_status = 'approved'
      and m.shared_at is not null
      and v.status = 'completed'
      and public.member_role(m.company_id) = 'customer'
      and public.snow_is_property_contact(m.property_id)
  )
$$;

-- ── Owner actions ───────────────────────────────────────────────────────────

-- Closes an item's open share (if any) and logs it. Internal.
create or replace function public._snow_media_unshare(m public.snow_completion_media, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_person_id();
begin
  if m.shared_at is null then return false; end if;
  update public.snow_media_shares
     set revoked_at = now(), revoked_by = me, revoke_reason = nullif(trim(p_reason), '')
   where media_id = m.id and revoked_at is null;
  update public.snow_completion_media set shared_at = null, shared_by = null where id = m.id;
  perform public.snow_log_event(m.company_id, 'media.unshared', 'completion_media', m.id,
    m.storm_id, m.route_id, m.visit_id, m.property_id, m.uploaded_by, m.service,
    jsonb_build_object('shared_at', m.shared_at), null, p_reason);
  return true;
end $$;
revoke all on function public._snow_media_unshare(public.snow_completion_media, text) from public, anon, authenticated;

-- Approve (pick for the customer), remove (leave out), or reset to unreviewed.
-- Works on several items at once; items already in that state are left as is.
-- Removing or resetting a shared item stops sharing it.
-- Returns how many items changed.
create or replace function public.snow_review_media(p_media_ids uuid[], p_decision text, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  m public.snow_completion_media;
  changed integer := 0;
  me uuid := public.my_person_id();
begin
  if p_decision not in ('approved', 'removed', 'unreviewed') then
    raise exception 'Choose approve, remove or reset.';
  end if;
  if p_media_ids is null or cardinality(p_media_ids) = 0 then return 0; end if;
  if exists (
    select 1 from unnest(p_media_ids) i(id)
    left join public.snow_completion_media x on x.id = i.id
    where x.id is null or not public.is_staff(x.company_id)
  ) then
    raise exception 'Only the owner or an admin can review snow photos and videos.';
  end if;

  perform set_config('snow.media_review', 'on', true);
  for m in
    select * from public.snow_completion_media where id = any(p_media_ids) order by created_at for update
  loop
    if m.review_status = p_decision then continue; end if;
    if p_decision <> 'approved' then
      perform public._snow_media_unshare(m, coalesce(p_note, case when p_decision = 'removed' then 'Removed in review' else 'Review reset' end));
    end if;
    update public.snow_completion_media
       set review_status = p_decision,
           reviewed_by = case when p_decision = 'unreviewed' then null else me end,
           reviewed_at = case when p_decision = 'unreviewed' then null else now() end,
           review_note = nullif(trim(p_note), '')
     where id = m.id;
    perform public.snow_log_event(m.company_id,
      case p_decision when 'approved' then 'media.approved' when 'removed' then 'media.removed' else 'media.review_reset' end,
      'completion_media', m.id, m.storm_id, m.route_id, m.visit_id, m.property_id, m.uploaded_by, m.service,
      jsonb_build_object('review_status', m.review_status), jsonb_build_object('review_status', p_decision), p_note);
    changed := changed + 1;
  end loop;
  perform set_config('snow.media_review', 'off', true);
  return changed;
end $$;

-- Share approved items with the property's customer contacts. Every item must
-- be approved and on a completed visit. Items already shared are left as is.
-- Returns {shared: newly shared items, viewers: customer accounts per
-- property that can now see them}. viewers = 0 means no customer account is
-- linked to that property yet, so nobody can see it until one is.
create or replace function public.snow_share_media(p_media_ids uuid[], p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.snow_completion_media;
  shared integer := 0;
  me uuid := public.my_person_id();
  bad text;
  viewers jsonb;
begin
  if p_media_ids is null or cardinality(p_media_ids) = 0 then
    return jsonb_build_object('shared', 0, 'viewers', '{}'::jsonb);
  end if;
  if exists (
    select 1 from unnest(p_media_ids) i(id)
    left join public.snow_completion_media x on x.id = i.id
    where x.id is null or not public.is_staff(x.company_id)
  ) then
    raise exception 'Only the owner or an admin can share snow photos and videos.';
  end if;
  select case
           when x.review_status <> 'approved' then 'Only approved photos and videos can be shared.'
           when v.status <> 'completed' then 'Only photos and videos from a completed visit can be shared.'
         end
    into bad
    from public.snow_completion_media x
    join public.snow_visits v on v.id = x.visit_id
   where x.id = any(p_media_ids) and (x.review_status <> 'approved' or v.status <> 'completed')
   limit 1;
  if bad is not null then raise exception '%', bad; end if;

  perform set_config('snow.media_review', 'on', true);
  for m in
    select * from public.snow_completion_media where id = any(p_media_ids) order by created_at for update
  loop
    if m.shared_at is not null then continue; end if;
    insert into public.snow_media_shares (company_id, media_id, visit_id, property_id, shared_by, note)
    values (m.company_id, m.id, m.visit_id, m.property_id, me, nullif(trim(p_note), ''));
    update public.snow_completion_media set shared_at = now(), shared_by = me where id = m.id;
    perform public.snow_log_event(m.company_id, 'media.shared', 'completion_media', m.id,
      m.storm_id, m.route_id, m.visit_id, m.property_id, m.uploaded_by, m.service,
      null, jsonb_build_object('shared_at', now()), p_note);
    shared := shared + 1;
  end loop;
  perform set_config('snow.media_review', 'off', true);

  select coalesce(jsonb_object_agg(p.property_id, (
           select count(*) from public.snow_property_contacts c
           join public.company_members cm on cm.company_id = c.company_id and cm.person_id = c.person_id
           where c.property_id = p.property_id and c.removed_at is null
             and cm.role = 'customer' and cm.status = 'active'
         )), '{}'::jsonb)
    into viewers
    from (select distinct property_id from public.snow_completion_media where id = any(p_media_ids)) p;
  return jsonb_build_object('shared', shared, 'viewers', viewers);
end $$;

-- Stop sharing items (e.g. shared by mistake). The share stays in history.
-- Returns how many items stopped being shared.
create or replace function public.snow_unshare_media(p_media_ids uuid[], p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  m public.snow_completion_media;
  changed integer := 0;
begin
  if p_media_ids is null or cardinality(p_media_ids) = 0 then return 0; end if;
  if exists (
    select 1 from unnest(p_media_ids) i(id)
    left join public.snow_completion_media x on x.id = i.id
    where x.id is null or not public.is_staff(x.company_id)
  ) then
    raise exception 'Only the owner or an admin can change sharing.';
  end if;
  perform set_config('snow.media_review', 'on', true);
  for m in
    select * from public.snow_completion_media where id = any(p_media_ids) order by created_at for update
  loop
    if public._snow_media_unshare(m, p_reason) then changed := changed + 1; end if;
  end loop;
  perform set_config('snow.media_review', 'off', true);
  return changed;
end $$;

-- ── Customer snow history ───────────────────────────────────────────────────

-- Completed snow services for the caller's properties, newest first, each
-- with the photos/videos shared from it. Nothing else about the storm.
-- p_property_id narrows to one property; p_before pages back in time.
-- Open files with signed links on media[].file_key (bucket "snow-media").
create or replace function public.snow_customer_history(
  p_property_id uuid default null,
  p_before timestamptz default null,
  p_limit integer default 50
) returns table (
  visit_id uuid,
  property_id uuid,
  property_name text,
  service text,
  title text,
  completed_at timestamptz,
  media jsonb
)
language sql stable security definer set search_path = public as $$
  select v.id, v.property_id, p.name, v.service,
         case v.service
           when 'plowing' then 'Plowing completed'
           when 'shoveling' then 'Sidewalk service completed'
           when 'salting' then 'Salting completed'
           else 'Snow service completed' end,
         v.completed_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', m.id, 'kind', m.kind, 'file_key', m.file_key,
                    'captured_at', coalesce(m.captured_at, m.created_at))
                  order by coalesce(m.captured_at, m.created_at))
           from public.snow_completion_media m
           where m.visit_id = v.id and m.review_status = 'approved' and m.shared_at is not null
         ), '[]'::jsonb)
  from public.snow_visits v
  join public.snow_properties p on p.id = v.property_id
  where v.status = 'completed'
    and v.completed_at is not null
    and public.member_role(v.company_id) = 'customer'
    and public.snow_is_property_contact(v.property_id)
    and (p_property_id is null or v.property_id = p_property_id)
    and (p_before is null or v.completed_at < p_before)
  order by v.completed_at desc, v.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

-- ── Access rules ────────────────────────────────────────────────────────────

alter table public.snow_media_shares enable row level security;
drop policy if exists snow_media_shares_staff_select on public.snow_media_shares;
create policy snow_media_shares_staff_select on public.snow_media_shares for select
  using (public.is_staff(company_id));

revoke all on function public.snow_review_media(uuid[], text, text) from public, anon;
revoke all on function public.snow_share_media(uuid[], text) from public, anon;
revoke all on function public.snow_unshare_media(uuid[], text) from public, anon;
revoke all on function public.snow_customer_history(uuid, timestamptz, integer) from public, anon;
revoke all on function public.snow_customer_can_see_media(uuid) from public, anon;
grant execute on function public.snow_review_media(uuid[], text, text) to authenticated;
grant execute on function public.snow_share_media(uuid[], text) to authenticated;
grant execute on function public.snow_unshare_media(uuid[], text) to authenticated;
grant execute on function public.snow_customer_history(uuid, timestamptz, integer) to authenticated;
grant execute on function public.snow_customer_can_see_media(uuid) to authenticated;

-- ── Completion files in the private bucket ──────────────────────────────────
-- Paths: {company_id}/completion/{visit_id}/{random}.{ext}

-- Is the caller the current lead of this visit's route, with the service, on
-- a storm that is still running?
create or replace function public.snow_is_visit_lead(p_visit_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.snow_visits v
    join public.snow_routes r on r.id = v.route_id
    join public.snow_storms s on s.id = v.storm_id
    where v.id = p_visit_id
      and r.lead_person_id = public.my_person_id()
      and r.cancelled_at is null
      and s.status = 'dispatched'
      and public.snow_has_service(v.company_id, v.service)
  )
$$;
revoke all on function public.snow_is_visit_lead(uuid) from public, anon;
grant execute on function public.snow_is_visit_lead(uuid) to authenticated;

-- Path checks run as the definer: storage rules are evaluated as the caller,
-- who (rightly) can't read the snow tables directly.
create or replace function public.snow_can_upload_completion_file(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.snow_visits v
    where (storage.foldername(p_name))[2] = 'completion'
      and v.id = public._try_uuid((storage.foldername(p_name))[3])
      and v.company_id = public._try_uuid((storage.foldername(p_name))[1])
      and (
        public.is_staff(v.company_id)
        or (v.status in ('pending', 'arrived') and public.snow_is_visit_lead(v.id))
      )
  )
$$;

create or replace function public.snow_can_read_completion_file(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select (storage.foldername(p_name))[2] = 'completion' and (
    public.is_staff(public._try_uuid((storage.foldername(p_name))[1]))
    or exists (
      select 1 from public.snow_visits v
      where v.id = public._try_uuid((storage.foldername(p_name))[3])
        and v.company_id = public._try_uuid((storage.foldername(p_name))[1])
        and public.snow_is_visit_lead(v.id)
    )
    or exists (
      select 1 from public.snow_completion_media m
      where m.file_key = p_name and public.snow_customer_can_see_media(m.id)
    )
  )
$$;

create or replace function public.snow_completion_file_saved(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.snow_completion_media m where m.file_key = p_name)
$$;

do $$
declare f text;
begin
  foreach f in array array['snow_can_upload_completion_file(text)', 'snow_can_read_completion_file(text)', 'snow_completion_file_saved(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Upload: owner/admin for any visit of their company; the visit's lead while
-- the visit is still open.
drop policy if exists snow_media_completion_upload on storage.objects;
create policy snow_media_completion_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'snow-media' and public.snow_can_upload_completion_file(name));

-- Read: owner/admin; the visit's lead during the storm; a customer only while
-- the item is shared with them.
drop policy if exists snow_media_completion_read on storage.objects;
create policy snow_media_completion_read on storage.objects for select to authenticated
  using (bucket_id = 'snow-media' and public.snow_can_read_completion_file(name));

-- Delete: only the uploader, and only a file never saved as media (a failed
-- or abandoned upload). Saved media files are kept.
drop policy if exists snow_media_completion_delete on storage.objects;
create policy snow_media_completion_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'snow-media'
    and (storage.foldername(name))[2] = 'completion'
    and owner = auth.uid()
    and not public.snow_completion_file_saved(name)
  );
