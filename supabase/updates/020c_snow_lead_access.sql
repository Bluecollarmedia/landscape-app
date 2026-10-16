-- ============================================================================
-- Update 20c — Snow Mode route lead access. Run once in Supabase → SQL Editor,
-- after updates 020 and 020b (safe to run again).
--  • A route's lead can read that route, its stops, the properties on it, its
--    completion photos/videos and its skip requests, and the storm it belongs
--    to. Nothing else: not other routes in the same storm, not other services.
--  • Only while the storm is dispatched (not while the owner is still
--    planning it), only while the route isn't cancelled, and only while the
--    lead still holds that route's service. Reassigning the lead, revoking the
--    service or revoking snow access takes it away at once.
--  • Being on the snow team, or holding a service, shows no routes by itself.
--    Non-leads only clock in and out (their own shift records, update 028).
--  • Read-only. Arrive / complete / upload / skip go through the server
--    functions in updates 026 and 027, never direct writes from the phone.
--  • Lead history and the activity log stay owner/admin only.
-- ============================================================================

-- Does the caller currently lead this route, with the route live?
create or replace function public.snow_leads_route(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.snow_routes r
    join public.snow_storms s on s.id = r.storm_id
    where r.id = rid
      and r.lead_person_id = public.my_person_id()
      and r.cancelled_at is null
      and s.status = 'dispatched'
      and exists (
        select 1 from public.snow_staff st
        join public.snow_staff_services ss on ss.company_id = st.company_id and ss.person_id = st.person_id
        where st.company_id = r.company_id and st.person_id = r.lead_person_id
          and st.status = 'active' and ss.service = r.service
      )
  )
$$;

-- Does the caller lead at least one live route in this storm?
create or replace function public.snow_leads_in_storm(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.snow_routes r
    where r.storm_id = sid and r.lead_person_id = public.my_person_id()
      and public.snow_leads_route(r.id)
  )
$$;

-- Is this property a stop on a route the caller leads?
create or replace function public.snow_leads_property(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.snow_visits v
    join public.snow_routes r on r.id = v.route_id
    where v.property_id = pid and r.lead_person_id = public.my_person_id()
      and public.snow_leads_route(r.id)
  )
$$;

-- ── Read rules (added beside the owner/admin rules from 020b) ───────────────

drop policy if exists snow_storms_lead_select on public.snow_storms;
create policy snow_storms_lead_select on public.snow_storms for select
  using (public.snow_leads_in_storm(id));

drop policy if exists snow_routes_lead_select on public.snow_routes;
create policy snow_routes_lead_select on public.snow_routes for select
  using (public.snow_leads_route(id));

drop policy if exists snow_visits_lead_select on public.snow_visits;
create policy snow_visits_lead_select on public.snow_visits for select
  using (public.snow_leads_route(route_id));

drop policy if exists snow_completion_media_lead_select on public.snow_completion_media;
create policy snow_completion_media_lead_select on public.snow_completion_media for select
  using (public.snow_leads_route(route_id));

drop policy if exists snow_skip_requests_lead_select on public.snow_skip_requests;
create policy snow_skip_requests_lead_select on public.snow_skip_requests for select
  using (public.snow_leads_route(route_id));

drop policy if exists snow_properties_lead_select on public.snow_properties;
create policy snow_properties_lead_select on public.snow_properties for select
  using (public.snow_leads_property(id));

-- The lead's screens need the company's snow rules (e.g. arrival before
-- completion). Any active snow employee may read them; never write them.
drop policy if exists snow_settings_team_select on public.snow_settings;
create policy snow_settings_team_select on public.snow_settings for select
  using (public.snow_is_active(company_id));
