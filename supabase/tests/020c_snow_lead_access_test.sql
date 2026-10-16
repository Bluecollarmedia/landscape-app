-- ============================================================================
-- Snow route lead access tests (update 020c). LOCAL TEST DATABASE ONLY: it
-- creates fake users (rolled back at the end). Needs 020 and 020b first.
-- Prints "ok - ..." per check and stops at the first FAIL.
--
-- Cast: owner; Pat and Paula (plowing), Sam (shoveling), Nina (plowing, never
-- a lead), Lee (landscaping worker), Cal (landscaping customer).
-- ============================================================================
\set ON_ERROR_STOP 1
begin;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function pg_temp.raises(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;

create temp table cast_ids (who text primary key, uid uuid, pid uuid);
grant select on cast_ids to authenticated;
create function pg_temp.as_user(w text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', (select uid::text from cast_ids where who = w), true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.p(w text) returns uuid language sql as $$ select pid from cast_ids where who = w $$;

do $$
declare w text; u uuid; p uuid;
begin
  foreach w in array array['owner','pat','paula','sam','nina','lee','cal'] loop
    insert into auth.users (email) values (w || '@snow.test') returning id into u;
    select id into p from public.people where user_id = u;
    if p is null then
      insert into public.people (user_id, email, first_name) values (u, w || '@snow.test', w) returning id into p;
    end if;
    insert into cast_ids values (w, u, p);
  end loop;
end $$;

select pg_temp.as_user('owner');
select public.create_company('{"name": "Brighton Test"}'::jsonb);
reset role;
create temp table co as select company_id as id from public.company_members where person_id = pg_temp.p('owner');
grant select on co to authenticated;
insert into public.company_members (company_id, person_id, role, status) values
  ((select id from co), pg_temp.p('lee'), 'worker', 'active'),
  ((select id from co), pg_temp.p('cal'), 'customer', 'active');

select pg_temp.as_user('owner');
select public.snow_grant_access(pg_temp.p('pat'), array['plowing']);
select public.snow_grant_access(pg_temp.p('paula'), array['plowing']);
select public.snow_grant_access(pg_temp.p('sam'), array['shoveling']);
select public.snow_grant_access(pg_temp.p('nina'), array['plowing']);

-- Plowing storm: Pat leads routes A and C, Paula leads B. Shoveling storm:
-- Sam leads S. A draft plowing storm (still being planned): Pat leads D.
create temp table ids (k text primary key, id uuid);
grant select on ids to authenticated;
insert into ids select k, gen_random_uuid() from unnest(array[
  'oak','elm','pine','maple','plow','shovel','draft','A','B','C','S','D']) k;
create function pg_temp.i(k text) returns uuid language sql as $$ select id from ids where ids.k = i.k $$;

insert into public.snow_properties (id, company_id, name, address) values
  (pg_temp.i('oak'), (select id from co), 'Oak Plaza', '1 Oak St'),
  (pg_temp.i('elm'), (select id from co), 'Elm Lot', '2 Elm St'),
  (pg_temp.i('pine'), (select id from co), 'Pine Court', '3 Pine St'),
  (pg_temp.i('maple'), (select id from co), 'Maple Walk', '4 Maple St');
insert into public.snow_storms (id, company_id, name, service) values
  (pg_temp.i('plow'), (select id from co), 'Jan 12 plow', 'plowing'),
  (pg_temp.i('shovel'), (select id from co), 'Jan 12 sidewalks', 'shoveling'),
  (pg_temp.i('draft'), (select id from co), 'Next storm', 'plowing');
insert into public.snow_routes (id, company_id, storm_id, service, name, lead_person_id) values
  (pg_temp.i('A'), (select id from co), pg_temp.i('plow'), 'plowing', 'Route A', pg_temp.p('pat')),
  (pg_temp.i('B'), (select id from co), pg_temp.i('plow'), 'plowing', 'Route B', pg_temp.p('paula')),
  (pg_temp.i('C'), (select id from co), pg_temp.i('plow'), 'plowing', 'Route C', pg_temp.p('pat')),
  (pg_temp.i('S'), (select id from co), pg_temp.i('shovel'), 'shoveling', 'Sidewalks', pg_temp.p('sam')),
  (pg_temp.i('D'), (select id from co), pg_temp.i('draft'), 'plowing', 'Route D', pg_temp.p('pat'));
-- Oak twice on A (two passes); Elm on B; Pine on C; Oak + Maple on the
-- shoveling route; Maple on the draft route.
insert into public.snow_visits (route_id, property_id) values
  (pg_temp.i('A'), pg_temp.i('oak')), (pg_temp.i('A'), pg_temp.i('oak')),
  (pg_temp.i('B'), pg_temp.i('elm')),
  (pg_temp.i('C'), pg_temp.i('pine')),
  (pg_temp.i('S'), pg_temp.i('oak')), (pg_temp.i('S'), pg_temp.i('maple')),
  (pg_temp.i('D'), pg_temp.i('maple'));
update public.snow_storms set status = 'dispatched', dispatched_at = now()
  where id in (pg_temp.i('plow'), pg_temp.i('shovel'));
reset role;
-- A completion photo and a skip request on each dispatched plowing route.
insert into public.snow_completion_media (visit_id, kind, file_key)
  select id, 'photo', 'k-' || id from public.snow_visits where route_id in (pg_temp.i('A'), pg_temp.i('B'));
insert into public.snow_skip_requests (company_id, storm_id, route_id, visit_id, property_id, requested_by, reason)
  select company_id, storm_id, route_id, id, property_id, pg_temp.p('paula'), 'Car parked in the lot'
  from public.snow_visits where route_id = pg_temp.i('B');

-- ── A lead sees their own routes, and only those ────────────────────────────
select pg_temp.as_user('pat');
select pg_temp.ok((select array_agg(name order by name) from public.snow_routes) = array['Route A', 'Route C'],
  'Pat sees both routes he leads in the storm (A and C), not Paula''s B');
select pg_temp.ok((select count(*) from public.snow_visits) = 3
  and not exists (select 1 from public.snow_visits where route_id = pg_temp.i('B')),
  'Pat sees the 3 stops on his routes, including both passes at Oak, and none of B''s');
select pg_temp.ok((select array_agg(name) from public.snow_storms) = array['Jan 12 plow'],
  'Pat sees his plowing storm and not the shoveling or draft storm');
select pg_temp.ok((select array_agg(name order by name) from public.snow_properties) = array['Oak Plaza', 'Pine Court'],
  'Pat sees only the properties on his routes');
select pg_temp.ok((select count(*) from public.snow_completion_media) = 2
  and (select count(*) from public.snow_skip_requests) = 0,
  'Pat sees his routes'' completion media and no one else''s skip requests');
select pg_temp.ok((select count(*) from public.snow_route_lead_assignments) = 0
  and (select count(*) from public.snow_activity_events) = 0,
  'Pat cannot read lead history or the activity log');
select pg_temp.ok((select count(*) from public.snow_settings) = 1, 'Pat can read the snow settings');

select pg_temp.as_user('paula');
select pg_temp.ok((select array_agg(name) from public.snow_routes) = array['Route B']
  and (select count(*) from public.snow_skip_requests) = 1,
  'Paula sees Route B and her own skip request');

-- ── Service separation ──────────────────────────────────────────────────────
select pg_temp.as_user('sam');
select pg_temp.ok((select array_agg(name) from public.snow_routes) = array['Sidewalks']
  and (select array_agg(name) from public.snow_storms) = array['Jan 12 sidewalks'],
  'Sam (shoveling) sees only his sidewalk route and storm');
select pg_temp.ok(not exists (select 1 from public.snow_visits where service = 'plowing')
  and (select count(*) from public.snow_completion_media) = 0,
  'Sam sees no plowing stops or plowing media, even at Oak which both services visit');

-- ── Being on the team is not route access ───────────────────────────────────
create function pg_temp.sees_nothing(w text) returns boolean language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.as_user(w);
  select (select count(*) from public.snow_storms) + (select count(*) from public.snow_routes)
       + (select count(*) from public.snow_visits) + (select count(*) from public.snow_properties)
       + (select count(*) from public.snow_completion_media) + (select count(*) from public.snow_skip_requests)
       + (select count(*) from public.snow_route_lead_assignments) + (select count(*) from public.snow_activity_events)
    into n;
  return n = 0;
end $$;
select pg_temp.ok(pg_temp.sees_nothing('nina'), 'Nina (plowing, not a lead) sees no storms, routes, stops or properties');
select pg_temp.ok(pg_temp.sees_nothing('lee'), 'landscaping worker sees nothing on the snow side');
select pg_temp.ok(pg_temp.sees_nothing('cal'), 'landscaping customer sees nothing on the snow side');
select pg_temp.as_user('lee');
select pg_temp.ok((select count(*) from public.snow_settings) = 0, 'landscaping worker cannot read snow settings');

-- ── Draft storms stay private until dispatch ────────────────────────────────
select pg_temp.as_user('pat');
select pg_temp.ok(not exists (select 1 from public.snow_routes where id = pg_temp.i('D'))
  and not exists (select 1 from public.snow_properties where name = 'Maple Walk'),
  'Pat cannot see Route D while its storm is still a draft');
select pg_temp.as_user('owner');
update public.snow_storms set status = 'dispatched', dispatched_at = now() where id = pg_temp.i('draft');
select pg_temp.as_user('pat');
select pg_temp.ok(exists (select 1 from public.snow_routes where id = pg_temp.i('D')),
  'and sees it once the owner dispatches');

-- ── Leads can't change anything directly ────────────────────────────────────
select pg_temp.ok(pg_temp.raises(format(
    'update public.snow_visits set position = position + 10 where route_id = %L', pg_temp.i('A')))
  or (select array_agg(position order by position) from public.snow_visits where route_id = pg_temp.i('A')) = array[1, 2],
  'Pat cannot reorder his stops');
update public.snow_visits set status = 'completed' where route_id = pg_temp.i('A');
update public.snow_visits set status = 'skipped' where route_id = pg_temp.i('A');
select pg_temp.ok(not exists (select 1 from public.snow_visits where route_id = pg_temp.i('A') and status <> 'pending'),
  'Pat cannot mark stops complete or skipped by writing to the table');
update public.snow_routes set lead_person_id = pg_temp.p('nina'), media_required = false where id = pg_temp.i('A');
select pg_temp.ok((select lead_person_id from public.snow_routes where id = pg_temp.i('A')) = pg_temp.p('pat'),
  'Pat cannot hand his route to someone else or change its rules');
select pg_temp.ok(pg_temp.raises(format(
    'insert into public.snow_visits (route_id, property_id) values (%L, %L)', pg_temp.i('A'), pg_temp.i('elm'))),
  'Pat cannot add stops');
select pg_temp.ok(pg_temp.raises(format(
    'insert into public.snow_completion_media (visit_id, kind, file_key) select id, ''photo'', ''x'' from public.snow_visits where route_id = %L limit 1',
    pg_temp.i('A'))),
  'Pat cannot insert media directly (uploads go through the server function)');
delete from public.snow_routes where id = pg_temp.i('A');
select pg_temp.ok(exists (select 1 from public.snow_routes where id = pg_temp.i('A')), 'Pat cannot delete his route');
select pg_temp.as_user('nina');
select pg_temp.ok(pg_temp.raises(format(
    'insert into public.snow_skip_requests (company_id, storm_id, route_id, visit_id, property_id, reason) select company_id, storm_id, route_id, id, property_id, ''x'' from public.snow_visits where route_id = %L',
    pg_temp.i('A'))) or (select count(*) from public.snow_skip_requests where route_id = pg_temp.i('A')) = 0,
  'a non-lead cannot file a skip request on someone else''s route');

-- ── Access follows the current lead and current service ─────────────────────
select pg_temp.as_user('owner');
update public.snow_routes set lead_person_id = pg_temp.p('paula') where id = pg_temp.i('C');
select pg_temp.as_user('pat');
select pg_temp.ok(not exists (select 1 from public.snow_routes where id = pg_temp.i('C'))
  and not exists (select 1 from public.snow_properties where name = 'Pine Court'),
  'after reassignment Pat loses Route C and its property at once');
select pg_temp.as_user('paula');
select pg_temp.ok(exists (select 1 from public.snow_routes where id = pg_temp.i('C')), 'and Paula gains it');

select pg_temp.as_user('owner');
update public.snow_routes set cancelled_at = now() where id = pg_temp.i('D');
select pg_temp.as_user('pat');
select pg_temp.ok(not exists (select 1 from public.snow_routes where id = pg_temp.i('D')), 'a cancelled route disappears for its lead');

select pg_temp.as_user('owner');
select public.snow_grant_access(pg_temp.p('pat'), array['salting']);
select pg_temp.ok(pg_temp.sees_nothing('pat'), 'taking plowing away from Pat hides his plowing routes immediately');
select pg_temp.as_user('owner');
select public.snow_grant_access(pg_temp.p('pat'), array['plowing']);
select pg_temp.as_user('pat');
select pg_temp.ok(exists (select 1 from public.snow_routes where id = pg_temp.i('A')), 'giving it back restores Route A');
select pg_temp.as_user('owner');
select public.snow_revoke_access(pg_temp.p('pat'));
select pg_temp.ok(pg_temp.sees_nothing('pat'), 'revoking Pat''s snow access hides everything');

-- ── Ended storms leave the lead's view; the owner keeps everything ─────────
select pg_temp.as_user('owner');
update public.snow_storms set status = 'ended', ended_at = now() where id = pg_temp.i('shovel');
select pg_temp.ok(pg_temp.sees_nothing('sam'), 'when the storm ends, its lead no longer sees it');
select pg_temp.as_user('owner');
select pg_temp.ok((select count(*) from public.snow_routes) = 5 and (select count(*) from public.snow_visits) = 7
  and (select count(*) from public.snow_route_lead_assignments) >= 6,
  'the owner still sees every route, stop and lead change');

\echo 'snow lead access: all tests passed'
rollback;
