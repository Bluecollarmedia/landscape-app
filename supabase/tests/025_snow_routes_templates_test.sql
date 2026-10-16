\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
-- Run after 020, 020b, 022 and 025. Lines starting EXPECT ERROR are followed
-- by the error the user would get.
alter table auth.users disable trigger all;
alter table public.company_members disable trigger all;
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000d');
insert into public.companies(id,name) values ('c0000000-0000-0000-0000-000000000001','Brighton');
insert into public.people(id,user_id,first_name) values
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a','Owner'),
 ('10000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000b','Plower'),
 ('10000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-00000000000d','Shoveler');
insert into public.company_members(company_id,person_id,role,status) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','owner','active'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b','worker','active'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000d','worker','active');
insert into public.snow_staff(company_id,person_id) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000d');
insert into public.snow_staff_services(company_id,person_id,service) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b','plowing'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000d','shoveling');

set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
insert into snow_properties(id,company_id,name,address) values
 ('20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Oak Plaza','1 Oak St'),
 ('20000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','Elm Lot','2 Elm St'),
 ('20000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','Pine Court','3 Pine St');
insert into snow_property_services(company_id,property_id,service) values
 ('c0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','plowing'),
 ('c0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','plowing'),
 ('c0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','plowing');
insert into snow_storms(id,company_id,name,service) values
 ('30000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Jan 12 plow','plowing'),
 ('30000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','Jan 13 plow','plowing');
insert into snow_routes(id,company_id,storm_id,service,name) values
 ('40000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','plowing','North'),
 ('40000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','plowing','South');

-- Stops: Oak, Elm, then a second pass at Oak, then Pine squeezed in at #2.
select 'add', snow_add_visit('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001') is not null;
select 'add', snow_add_visit('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002') is not null;
select 'add repeat pass', snow_add_visit('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001') is not null;
select 'insert at 2', snow_add_visit('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003', 2, '99999999-0000-0000-0000-000000000001') is not null;
select 'retry same request', snow_add_visit('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003', 2, '99999999-0000-0000-0000-000000000001')
  = (select id from snow_visits where client_request_id='99999999-0000-0000-0000-000000000001');
select 'order', string_agg(position || ':' || property_name, ', ' order by position) from snow_visits where route_id='40000000-0000-0000-0000-000000000001';
select 'Oak visits on North (distinct records)', count(distinct id) from snow_visits where route_id='40000000-0000-0000-0000-000000000001' and property_id='20000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR property without the service:
insert into snow_properties(id,company_id,name) values ('20000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001','Birch (sidewalks only)');
select snow_add_visit('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004');

-- Drag & drop: reverse the route.
select snow_reorder_route('40000000-0000-0000-0000-000000000001',
  (select array_agg(id order by position desc) from snow_visits where route_id='40000000-0000-0000-0000-000000000001')) \g /dev/null
select 'reversed', string_agg(position || ':' || property_name, ', ' order by position) from snow_visits where route_id='40000000-0000-0000-0000-000000000001';
select 'reorder logged', count(*) from snow_activity_events where action='route.reordered';
\echo EXPECT ERROR stale order (one stop missing):
select snow_reorder_route('40000000-0000-0000-0000-000000000001',
  (select (array_agg(id order by position))[1:3] from snow_visits where route_id='40000000-0000-0000-0000-000000000001'));

-- Lead: the plower leads North; leading South too only warns.
select 'assign North', snow_assign_lead('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b');
select 'South, not confirmed', snow_assign_lead('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000b')->>'assigned',
  jsonb_array_length(snow_assign_lead('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000b')->'conflicts');
select 'South lead still empty', lead_person_id is null from snow_routes where id='40000000-0000-0000-0000-000000000002';
select 'South, confirmed', snow_assign_lead('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000b', true)->>'assigned';
select 'routes led by plower', count(*) from snow_routes where lead_person_id='10000000-0000-0000-0000-00000000000b';
\echo EXPECT ERROR shoveler leading a plowing route:
select snow_assign_lead('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000d', true);

-- Dispatch, then work the first stop.
update snow_storms set status='dispatched', dispatched_at=now() where id='30000000-0000-0000-0000-000000000001';
update snow_visits set status='arrived', arrived_at=now(), arrived_by='10000000-0000-0000-0000-00000000000b'
 where route_id='40000000-0000-0000-0000-000000000001' and position=1;
-- Add a stop right after the one being worked (ahead of the lead's next stop).
select 'add after dispatch at 2', v.added_after_dispatch from snow_visits v,
  (select snow_add_visit('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002', 2) as id) a where v.id = a.id;
select 'after insert', string_agg(position || ':' || property_name || ':' || status, ', ' order by position) from snow_visits where route_id='40000000-0000-0000-0000-000000000001';
-- Reassign North to the owner mid-storm: history keeps both.
select 'reassign', snow_assign_lead('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a', true)->>'assigned';
select 'North lead history rows', count(*) from snow_route_lead_assignments where route_id='40000000-0000-0000-0000-000000000001';
-- Move the last pending stop to South; the started one can't move.
select snow_move_visit((select id from snow_visits where route_id='40000000-0000-0000-0000-000000000001' order by position desc limit 1),
  '40000000-0000-0000-0000-000000000002', 1) \g /dev/null
select 'North after move', string_agg(position || ':' || property_name, ', ' order by position) from snow_visits where route_id='40000000-0000-0000-0000-000000000001';
select 'South after move', string_agg(position || ':' || property_name, ', ' order by position) from snow_visits where route_id='40000000-0000-0000-0000-000000000002';
\echo EXPECT ERROR moving a started stop:
select snow_move_visit((select id from snow_visits where route_id='40000000-0000-0000-0000-000000000001' and status='arrived'), '40000000-0000-0000-0000-000000000002');
\echo EXPECT ERROR removing a started stop:
select snow_remove_visit((select id from snow_visits where route_id='40000000-0000-0000-0000-000000000001' and status='arrived'));
select snow_remove_visit((select id from snow_visits where route_id='40000000-0000-0000-0000-000000000001' and position=2)) \g /dev/null
select 'North after remove', string_agg(position || ':' || property_name, ', ' order by position) from snow_visits where route_id='40000000-0000-0000-0000-000000000001';

-- Templates: save North, use it in the next storm, then edit the template.
select 'template saved', snow_save_route_as_template('40000000-0000-0000-0000-000000000001','North loop') is not null;
select 'template', name, service, version, (select count(*) from snow_route_template_stops s where s.template_id=t.id) from snow_route_templates t;
update snow_properties set status='inactive' where id='20000000-0000-0000-0000-000000000003';
select 'apply', r->>'added', r->'skipped'->0->>'reason', r->>'lead_dropped'
  from (select snow_apply_template((select id from snow_route_templates), '30000000-0000-0000-0000-000000000002', null, '88888888-0000-0000-0000-000000000001') r) x;
select 'apply retry makes no second route', count(*) from snow_routes where storm_id='30000000-0000-0000-0000-000000000002'
  and (snow_apply_template((select id from snow_route_templates), '30000000-0000-0000-0000-000000000002', null, '88888888-0000-0000-0000-000000000001')->>'repeated')::boolean;
select 'new route', name, template_version, lead_person_id is not null, (select count(*) from snow_visits v where v.route_id=r.id) from snow_routes r where storm_id='30000000-0000-0000-0000-000000000002';
select snow_set_template_stops((select id from snow_route_templates), array['20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002']::uuid[]) \g /dev/null
update snow_route_templates set name='North loop v2';
select 'template after edits', name, version, (select string_agg(property_id::text, ',') from snow_route_template_stops s where s.template_id=t.id) like '20000000-0000-0000-0000-000000000002,%' from snow_route_templates t;
select 'Jan 13 route unchanged by template edit', template_version, (select count(*) from snow_visits v where v.route_id=r.id), template_snapshot->>'name'
  from snow_routes r where storm_id='30000000-0000-0000-0000-000000000002';
\echo EXPECT ERROR template for another service:
insert into snow_storms(id,company_id,name,service) values ('30000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','Walks','shoveling');
select snow_apply_template((select id from snow_route_templates), '30000000-0000-0000-0000-000000000003');
\echo BLOCKED (0 rows) direct stop edit:
delete from snow_route_template_stops;

-- Ended storms take no route edits until reopened.
update snow_storms set status='ended', ended_at=now() where id='30000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR add to ended storm:
select snow_add_visit('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');

-- The lead (a worker) can't touch the order, the stops or templates.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \g /dev/null
\echo EXPECT ERROR lead reorders:
select snow_reorder_route('40000000-0000-0000-0000-000000000002', (select array_agg(id) from snow_visits where route_id='40000000-0000-0000-0000-000000000002'));
\echo EXPECT ERROR lead adds a stop:
select snow_add_visit('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
\echo EXPECT ERROR lead assigns themself:
select snow_assign_lead('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b', true);
select 'worker sees templates', count(*) from snow_route_templates;
select 'worker sees conflicts', count(*) from snow_lead_conflicts('10000000-0000-0000-0000-00000000000b');
reset role;
select 'activity', action, count(*) from snow_activity_events where action in ('route.reordered','route.from_template','template.created','template.stops_changed','visit.added','visit.moved','visit.removed','route.lead_assigned','route.lead_ended') group by action order by action;
