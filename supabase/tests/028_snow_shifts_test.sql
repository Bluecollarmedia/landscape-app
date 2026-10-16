\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
-- Fixture: owner, a dual-mode worker (landscaping + snow plowing), a
-- snow-only shoveler who is NOT a route lead, a pending applicant with no snow
-- access, and a customer. Lines starting EXPECT ERROR are followed by the
-- error the user would get.
alter table auth.users disable trigger all;
alter table public.company_members disable trigger all;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),
 ('00000000-0000-0000-0000-00000000000d'),('00000000-0000-0000-0000-00000000000e'),
 ('00000000-0000-0000-0000-00000000000c');
insert into public.companies(id,name) values ('c0000000-0000-0000-0000-000000000001','Brighton');
insert into public.people(id,user_id,first_name,last_name) values
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a','Owner',''),
 ('10000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000b','Dual','Worker'),
 ('10000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-00000000000d','Snow','Shoveler'),
 ('10000000-0000-0000-0000-00000000000e','00000000-0000-0000-0000-00000000000e','Pending','Applicant'),
 ('10000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000c','Customer','');
insert into public.company_members(company_id,person_id,role,status) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','owner','active'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b','worker','active'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000c','customer','active');
insert into public.snow_staff(company_id,person_id) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000d');
insert into public.snow_staff_services(company_id,person_id,service) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b','plowing'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000d','shoveling');

set role authenticated;

-- SNOW-ONLY SHOVELER (not a lead, no routes exist at all) clocks in.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false) \g /dev/null
select 'shoveler clocks in, status', status, recorded_clock_in_at = clock_in_at from snow_clock_in('c0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001');
select 'retry same request id, same shift', count(distinct id) from (
  select id from snow_clock_in('c0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001')
  union all select id from snow_shifts) x;
select 'double tap with a new id returns the open shift', (select id from snow_clock_in('c0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002')) = (select id from snow_shifts where status='open');
select 'shoveler open shifts', count(*) from snow_shifts where status='open';
select 'shoveler sees routes/visits/properties (should be 0)', (select count(*) from snow_routes)+(select count(*) from snow_visits)+(select count(*) from snow_properties);
select 'no GPS columns on snow_shifts', count(*) from information_schema.columns where table_name='snow_shifts' and (column_name ilike '%gps%' or column_name ilike '%lat%' or column_name ilike '%location%');
\echo EXPECT ERROR shoveler writes the table directly:
update snow_shifts set clock_in_at = clock_in_at - interval '3 hours';
\echo EXPECT ERROR shoveler corrects own time:
select snow_correct_shift((select id from snow_shifts limit 1), now() - interval '5 hours', null, 'I started early');
select pg_sleep(0.01) \g /dev/null
select 'shoveler clocks out, status', status, clock_out_at > clock_in_at from snow_clock_out('c0000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001');
select 'retry clock-out, same shift', status from snow_clock_out('c0000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001');
\echo EXPECT ERROR clock out again with a new id:
select snow_clock_out('c0000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000002');

-- DUAL-MODE WORKER clocks in; sees only own shift.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \g /dev/null
select 'dual worker clocks in', status from snow_clock_in('c0000000-0000-0000-0000-000000000001');
select 'dual worker sees only own shifts', count(*), bool_and(person_id='10000000-0000-0000-0000-00000000000b') from snow_shifts;
select 'landscaping work_sessions untouched', count(*) from work_sessions;

-- PENDING APPLICANT and CUSTOMER can't clock in or read anything.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false) \g /dev/null
\echo EXPECT ERROR pending applicant clocks in:
select snow_clock_in('c0000000-0000-0000-0000-000000000001');
select 'applicant sees shifts', count(*) from snow_shifts;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false) \g /dev/null
\echo EXPECT ERROR customer clocks in:
select snow_clock_in('c0000000-0000-0000-0000-000000000001');
select 'customer sees shifts', count(*) from snow_shifts;
\echo EXPECT ERROR customer reads time records:
select * from snow_time_records('c0000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '1 day');

-- OWNER reviews and corrects.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
select 'owner sees all shifts', count(*) from snow_shifts;
select 'records', person_name, status from snow_time_records('c0000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '1 day') order by person_name;
\echo EXPECT ERROR correction without a reason:
select snow_correct_shift((select id from snow_shifts where person_id='10000000-0000-0000-0000-00000000000d'), now() - interval '5 hours', now() - interval '1 hour', '  ');
\echo EXPECT ERROR clock-out before clock-in:
select snow_correct_shift((select id from snow_shifts where person_id='10000000-0000-0000-0000-00000000000d'), now() - interval '1 hour', now() - interval '5 hours', 'Typo');
\echo EXPECT ERROR clearing the clock-out of a finished shift:
select snow_correct_shift((select id from snow_shifts where person_id='10000000-0000-0000-0000-00000000000d'), now() - interval '5 hours', null, 'Reopen');
select 'owner corrects shoveler', status, round(extract(epoch from clock_out_at - clock_in_at)/3600) as hours
  from snow_correct_shift((select id from snow_shifts where person_id='10000000-0000-0000-0000-00000000000d'), now() - interval '5 hours', now() - interval '1 hour', 'Forgot to clock in at the yard');
select 'original tap kept', recorded_clock_in_at <> clock_in_at, recorded_clock_out_at is not null, correction_count from snow_shifts where person_id='10000000-0000-0000-0000-00000000000d';
select 'correction row', kind, reason, corrected_by='10000000-0000-0000-0000-00000000000a', before->>'status', after->>'status' from snow_shift_corrections;
-- Dual worker forgot to clock out: owner closes the open shift.
select 'owner closes forgotten shift', status from snow_correct_shift((select id from snow_shifts where person_id='10000000-0000-0000-0000-00000000000b'), (select clock_in_at from snow_shifts where person_id='10000000-0000-0000-0000-00000000000b'), now(), 'Forgot to clock out');
select 'recorded clock-out stays empty (employee never tapped it)', recorded_clock_out_at is null from snow_shifts where person_id='10000000-0000-0000-0000-00000000000b';
-- Void an accidental shift.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \g /dev/null
select 'dual worker accidental clock-in', status from snow_clock_in('c0000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
select 'owner voids it', status from snow_void_shift((select id from snow_shifts where person_id='10000000-0000-0000-0000-00000000000b' and status='open'), 'Tapped by mistake');
select 'voided counts zero minutes', worked_minutes from snow_time_records('c0000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '1 day') where status='voided';
\echo EXPECT ERROR changing a voided shift:
select snow_correct_shift((select id from snow_shifts where status='voided'), now() - interval '2 hours', now() - interval '90 minutes', 'x');
\echo EXPECT ERROR owner deletes a shift:
reset role;
delete from snow_shifts where status='voided';
\echo EXPECT ERROR editing a correction:
update snow_shift_corrections set reason='changed';
\echo EXPECT ERROR rewriting the recorded tap:
update snow_shifts set recorded_clock_in_at = now() where person_id='10000000-0000-0000-0000-00000000000d';
select 'activity log', action, count(*) from snow_activity_events where entity_type='shift' group by action order by action;
select 'all shifts still on record', count(*) from snow_shifts;

-- Revoked mid-shift: can still clock out, can't clock in again.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false) \g /dev/null
select 'shoveler clocks in again', status from snow_clock_in('c0000000-0000-0000-0000-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
\echo EXPECT ERROR moving the new shift start into the earlier shift (overlap):
select snow_correct_shift((select id from snow_shifts where person_id='10000000-0000-0000-0000-00000000000d' and status='open'), now() - interval '2 hours', null, 'Started earlier');
select 'owner moves the open shift start, it keeps running', status from snow_correct_shift((select id from snow_shifts where person_id='10000000-0000-0000-0000-00000000000d' and status='open'), now() - interval '30 minutes', null, 'Started at the yard');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false) \g /dev/null
reset role;
update snow_staff set status='revoked' where person_id='10000000-0000-0000-0000-00000000000d';
set role authenticated;
select pg_sleep(0.01) \g /dev/null
select 'revoked shoveler can still clock out', status from snow_clock_out('c0000000-0000-0000-0000-000000000001');
\echo EXPECT ERROR revoked shoveler clocks in:
select snow_clock_in('c0000000-0000-0000-0000-000000000001');

-- Deleting the account still works (cascade), and takes its time records.
reset role;
delete from people where id='10000000-0000-0000-0000-00000000000d';
select 'shifts left after deleting the shoveler account', count(*) from snow_shifts;
