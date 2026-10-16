-- ============================================================================
-- Update 30 — run once in Supabase → SQL Editor, after 022 and 026
-- (safe to run again).
--  • The owner/admin reviews each completion photo/video (approve or hide)
--    before anything reaches a customer. New media starts as "to review".
--  • "Send update" on a completed stop shares its approved media with the
--    property's linked customer contacts and puts one in-app notification in
--    each one's bell (which also pushes to their phone, update 008). Sending
--    again for the same stop shares newly approved media but doesn't notify
--    twice.
--  • Customers read their updates through snow_customer_updates(): completed
--    stops at properties where they're a linked contact, with only the media
--    that was shared. They never see hidden or unreviewed media, routes,
--    leads or notes.
-- ============================================================================

alter table public.snow_completion_media add column if not exists review_status text not null default 'pending';
alter table public.snow_completion_media drop constraint if exists snow_completion_media_review_status_check;
alter table public.snow_completion_media add constraint snow_completion_media_review_status_check
  check (review_status in ('pending', 'approved', 'hidden'));
alter table public.snow_completion_media add column if not exists reviewed_by uuid references public.people(id) on delete set null;
alter table public.snow_completion_media add column if not exists reviewed_at timestamptz;
alter table public.snow_completion_media add column if not exists shared_at timestamptz;
alter table public.snow_completion_media add column if not exists shared_by uuid references public.people(id) on delete set null;

alter table public.snow_visits add column if not exists customer_notified_at timestamptz;

-- Shared media stays shared: it can't be hidden or un-shared afterwards
-- (the customer may already have saved it).
create or replace function public.snow_media_share_guard()
returns trigger language plpgsql as $$
begin
  if old.shared_at is not null and (new.shared_at is distinct from old.shared_at or new.review_status <> 'approved') then
    raise exception 'This photo was already sent to the customer and can''t be changed.';
  end if;
  if new.shared_at is not null and new.review_status <> 'approved' then
    raise exception 'Approve a photo before sending it to the customer.';
  end if;
  return new;
end;
$$;
drop trigger if exists snow_completion_media_share_guard on public.snow_completion_media;
create trigger snow_completion_media_share_guard before update on public.snow_completion_media
  for each row execute function public.snow_media_share_guard();

-- ── Owner/admin: review ─────────────────────────────────────────────────────

create or replace function public.snow_review_media(p_media_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.snow_completion_media;
begin
  select * into m from public.snow_completion_media where id = p_media_id;
  if m.id is null or not public.is_staff(m.company_id) then raise exception 'Photo not found.'; end if;
  if p_status not in ('approved', 'hidden') then raise exception 'Choose approve or hide.'; end if;
  if m.review_status = p_status then return; end if;
  update public.snow_completion_media
     set review_status = p_status, reviewed_by = public.my_person_id(), reviewed_at = now()
   where id = m.id;
  perform public.snow_log_event(m.company_id, 'media.' || case when p_status = 'approved' then 'approved' else 'hidden' end,
                                'snow_completion_media', m.id, m.storm_id, m.route_id, m.visit_id, m.property_id,
                                p_service => m.service);
end;
$$;

-- ── Owner/admin: send the update to the customer ────────────────────────────
-- Returns how many customers were notified this time.

create or replace function public.snow_send_customer_update(p_visit_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v public.snow_visits;
  shared int;
  notified int := 0;
  c record;
  svc text;
begin
  select * into v from public.snow_visits where id = p_visit_id;
  if v.id is null or not public.is_staff(v.company_id) then raise exception 'Stop not found.'; end if;
  if v.status <> 'completed' then raise exception 'Only a completed stop can be sent to the customer.'; end if;
  if exists (select 1 from public.snow_completion_media where visit_id = v.id and review_status = 'pending') then
    raise exception 'Approve or hide every photo for this stop first.';
  end if;

  update public.snow_completion_media
     set shared_at = now(), shared_by = public.my_person_id()
   where visit_id = v.id and review_status = 'approved' and shared_at is null;
  get diagnostics shared = row_count;

  if v.customer_notified_at is null then
    svc := case v.service when 'plowing' then 'Plowing' when 'shoveling' then 'Shoveling' else 'Salting' end;
    for c in
      select distinct person_id from public.snow_property_contacts
       where property_id = v.property_id and person_id is not null and removed_at is null
    loop
      insert into public.app_notifications (company_id, recipient_id, event_type, title, body, linked_entity_type, linked_entity_id)
      values (v.company_id, c.person_id, 'snow_visit_completed',
              svc || ' done at ' || coalesce(v.property_name, 'your property'),
              'Tap to see the photos.', 'snow_visit', v.id::text);
      notified := notified + 1;
    end loop;
    update public.snow_visits set customer_notified_at = now() where id = v.id;
  end if;

  perform public.snow_log_event(v.company_id, 'visit.customer_update_sent', 'snow_visit', v.id, v.storm_id, v.route_id,
                                v.id, v.property_id, p_service => v.service,
                                p_after => jsonb_build_object('media_shared', shared, 'customers_notified', notified));
  return notified;
end;
$$;

-- ── Customer: their updates ─────────────────────────────────────────────────

create or replace function public.snow_customer_updates()
returns table (
  visit_id uuid, property_name text, service text, completed_at timestamptz, media jsonb
)
language sql stable security definer set search_path = public as $$
  select v.id, v.property_name, v.service, v.completed_at,
         coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'file_key', m.file_key) order by m.created_at)
                     from public.snow_completion_media m
                    where m.visit_id = v.id and m.shared_at is not null), '[]'::jsonb)
    from public.snow_visits v
   where v.status = 'completed'
     and v.customer_notified_at is not null
     and exists (select 1 from public.snow_property_contacts c
                  where c.property_id = v.property_id and c.person_id = public.my_person_id() and c.removed_at is null)
   order by v.completed_at desc
   limit 100
$$;

revoke all on function public.snow_review_media(uuid, text) from public;
revoke all on function public.snow_send_customer_update(uuid) from public;
revoke all on function public.snow_customer_updates() from public;
grant execute on function public.snow_review_media(uuid, text) to authenticated;
grant execute on function public.snow_send_customer_update(uuid) to authenticated;
grant execute on function public.snow_customer_updates() to authenticated;

-- Customers can open shared completion media files (signed links), nothing else.
drop policy if exists snow_media_completion_customer_read on storage.objects;
create policy snow_media_completion_customer_read on storage.objects for select to authenticated
  using (
    bucket_id = 'snow-media'
    and (storage.foldername(name))[2] = 'completion'
    and exists (
      select 1 from public.snow_completion_media m
      join public.snow_property_contacts c on c.property_id = m.property_id
      where m.file_key = name and m.shared_at is not null
        and c.person_id = public.my_person_id() and c.removed_at is null
    )
  );
