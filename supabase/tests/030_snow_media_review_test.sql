\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
-- Fixture: owner O, plow lead P, plow crew N (leads nothing), customer C
-- (linked contact of Oak Plaza), customer D (not a contact), another
-- company's owner X. Lines starting EXPECT ERROR are followed by the error
-- the user would get.
alter table auth.users disable trigger all;
alter table public.company_members disable trigger all;
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000d'),('00000000-0000-0000-0000-00000000000e'),('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-00000000000f');
insert into public.companies(id,name) values ('c0000000-0000-0000-0000-000000000001','Brighton'),('c0000000-0000-0000-0000-000000000002','Other');
insert into public.people(id,user_id,first_name) values
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a','Owner'),
 ('10000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000b','PlowLead'),
 ('10000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-00000000000d','PlowCrew'),
 ('10000000-0000-0000-0000-00000000000e','00000000-0000-0000-0000-00000000000e','CustomerC'),
 ('10000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000c','CustomerD'),
 ('10000000-0000-0000-0000-00000000000f','00000000-0000-0000-0000-00000000000f','OtherOwner');
insert into public.company_members(company_id,person_id,role,status) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','owner','active'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b','worker','active'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000d','worker','active'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000e','customer','active'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000c','customer','active'),
 ('c0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000f','owner','active');
insert into snow_staff(company_id,person_id) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000d');
insert into snow_staff_services(company_id,person_id,service) values
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000b','plowing'),
 ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000d','plowing');

-- OWNER: Oak Plaza (plowing, contact C), a storm with one route led by P and
-- two passes at Oak Plaza, dispatched.
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
insert into snow_properties(id,company_id,name,notes) values ('20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Oak Plaza','Gate code 4411');
insert into snow_property_services(id,company_id,property_id,service) values ('30000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','plowing');
insert into snow_property_contacts(company_id,property_id,name,person_id) values ('c0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Manager','10000000-0000-0000-0000-00000000000e');
insert into snow_storms(id,company_id,name,service) values ('50000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Jan 12 plow','plowing');
insert into snow_routes(id,company_id,storm_id,service,name,lead_person_id) values ('60000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','plowing','Plow 1','10000000-0000-0000-0000-00000000000b');
insert into snow_visits(id,company_id,storm_id,route_id,property_id,service,position) values
 ('70000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','plowing',1),
 ('70000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','plowing',2);
update snow_storms set status='dispatched' where id='50000000-0000-0000-0000-000000000001';
reset role;

-- Lead P uploads three items at pass 1 (rows inserted as the server; the lead's
-- own insert rule belongs to update 26). Trying to pre-approve/share is ignored.
insert into snow_completion_media(id,visit_id,kind,file_key,uploaded_by,review_status,shared_at) values
 ('80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','photo','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000001/m1.jpg','10000000-0000-0000-0000-00000000000b','approved',now()),
 ('80000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001','photo','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000001/m2.jpg','10000000-0000-0000-0000-00000000000b','unreviewed',null),
 ('80000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000001','video','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000001/m3.mov','10000000-0000-0000-0000-00000000000b','unreviewed',null);
insert into storage.objects(bucket_id,name,owner) values
 ('snow-media','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000001/m1.jpg','00000000-0000-0000-0000-00000000000b'),
 ('snow-media','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000001/m2.jpg','00000000-0000-0000-0000-00000000000b'),
 ('snow-media','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000001/m3.mov','00000000-0000-0000-0000-00000000000b');
select 'new uploads start unreviewed and unshared (sent approved+shared):', string_agg(review_status || '/' || coalesce(shared_at::text,'not shared'), ', ' order by id) from snow_completion_media;

-- CUSTOMER C before the visit is completed
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false) \g /dev/null
select 'customer history before completion (expect 0):', count(*) from snow_customer_history();
reset role;

-- Pass 1 is completed by the lead (through the visit guard; the lead's own
-- arrive/complete functions belong to update 26).
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \g /dev/null
update snow_visits set status='arrived' where id='70000000-0000-0000-0000-000000000001';
update snow_visits set status='completed' where id='70000000-0000-0000-0000-000000000001';

set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false) \g /dev/null
select 'customer history after completion, nothing shared yet:', title, jsonb_array_length(media) from snow_customer_history();
reset role;

-- LEAD and CREW can't review or share
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \g /dev/null
\echo EXPECT ERROR lead approving media:
select snow_review_media(array['80000000-0000-0000-0000-000000000001']::uuid[], 'approved');
\echo EXPECT ERROR lead sharing media:
select snow_share_media(array['80000000-0000-0000-0000-000000000001']::uuid[]);
select 'lead can open all three files during the storm:', count(*) from storage.objects where bucket_id='snow-media';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false) \g /dev/null
select 'crew who leads nothing sees files:', count(*) from storage.objects where bucket_id='snow-media';
-- OTHER COMPANY
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false) \g /dev/null
\echo EXPECT ERROR owner of another company reviewing:
select snow_review_media(array['80000000-0000-0000-0000-000000000001']::uuid[], 'approved');
select 'other company sees files:', count(*) from storage.objects where bucket_id='snow-media';
reset role;

-- OWNER reviews item by item
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
\echo EXPECT ERROR owner changing review status directly:
update snow_completion_media set review_status='approved' where id='80000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR owner writing share history directly:
insert into snow_media_shares(company_id,media_id,visit_id,property_id) values ('c0000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
select 'approve m1 (changed):', snow_review_media(array['80000000-0000-0000-0000-000000000001']::uuid[], 'approved');
select 'approve m1 again (changed):', snow_review_media(array['80000000-0000-0000-0000-000000000001']::uuid[], 'approved');
select 'remove m2 (changed):', snow_review_media(array['80000000-0000-0000-0000-000000000002']::uuid[], 'removed', 'Blurry');
\echo EXPECT ERROR sharing a removed item:
select snow_share_media(array['80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002']::uuid[]);
\echo EXPECT ERROR sharing an unreviewed item:
select snow_share_media(array['80000000-0000-0000-0000-000000000003']::uuid[]);
select 'nothing was shared by the failed calls:', count(*) from snow_media_shares;
select 'share m1:', snow_share_media(array['80000000-0000-0000-0000-000000000001']::uuid[], 'After first pass');
select 'share m1 again (no double share):', snow_share_media(array['80000000-0000-0000-0000-000000000001']::uuid[]);
select 'statuses now:', string_agg(review_status || '/' || case when shared_at is null then 'not shared' else 'shared' end, ', ' order by id) from snow_completion_media;
select 'removed m2 still recorded with uploader and note:', count(*) from snow_completion_media where id='80000000-0000-0000-0000-000000000002' and uploaded_by='10000000-0000-0000-0000-00000000000b' and review_note='Blurry';
reset role;

-- CUSTOMER C sees exactly the shared item, and nothing internal
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false) \g /dev/null
select 'customer history:', title, property_name, jsonb_array_length(media), media->0->>'id' from snow_customer_history();
select 'customer history row has no lead/route/notes fields:', string_agg(key, ',' order by key) from (select jsonb_object_keys(to_jsonb(h)) key from snow_customer_history() h) k;
select 'customer files visible (expect only m1):', string_agg(split_part(name,'/',4), ',') from storage.objects where bucket_id='snow-media';
select 'customer reads completion media table:', count(*) from snow_completion_media;
select 'customer reads share history:', count(*) from snow_media_shares;
select 'customer reads visits:', count(*) from snow_visits;
select 'customer reads routes:', count(*) from snow_routes;
select 'customer reads skip requests:', count(*) from snow_skip_requests;
select 'customer reads activity log:', count(*) from snow_activity_events;
\echo EXPECT ERROR customer approving media:
select snow_review_media(array['80000000-0000-0000-0000-000000000002']::uuid[], 'approved');
\echo EXPECT ERROR customer uploading into a completion folder:
insert into storage.objects(bucket_id,name) values ('snow-media','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000002/x.jpg');
-- CUSTOMER D (not a contact of Oak Plaza)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false) \g /dev/null
select 'other customer history:', count(*) from snow_customer_history();
select 'other customer files:', count(*) from storage.objects where bucket_id='snow-media';
reset role;

-- Pass 2 is still pending: its media can't be shared, and it isn't in history
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
insert into snow_completion_media(id,visit_id,kind,file_key) values ('80000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000002','photo','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000002/m4.jpg');
select 'approve m4 on pending pass 2:', snow_review_media(array['80000000-0000-0000-0000-000000000004']::uuid[], 'approved');
\echo EXPECT ERROR sharing media from a visit that is not completed:
select snow_share_media(array['80000000-0000-0000-0000-000000000004']::uuid[]);
-- Owner adds a photo to the completed pass 1: unreviewed, not visible.
insert into snow_completion_media(id,visit_id,kind,file_key,review_status) values ('80000000-0000-0000-0000-000000000005','70000000-0000-0000-0000-000000000001','photo','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000001/m5.jpg','approved');
select 'owner-added photo:', review_status, (uploaded_by='10000000-0000-0000-0000-00000000000a') from snow_completion_media where id='80000000-0000-0000-0000-000000000005';
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false) \g /dev/null
select 'customer history still one completed visit with one item:', count(*), max(jsonb_array_length(media)) from snow_customer_history();
reset role;

-- Storage uploads and cleanup
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \g /dev/null
insert into storage.objects(bucket_id,name,owner) values ('snow-media','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000002/up.jpg','00000000-0000-0000-0000-00000000000b');
select 'lead uploaded to open pass 2:', count(*) from storage.objects where name like '%/up.jpg';
\echo EXPECT ERROR lead uploading to completed pass 1:
insert into storage.objects(bucket_id,name,owner) values ('snow-media','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000001/late.jpg','00000000-0000-0000-0000-00000000000b');
with x as (delete from storage.objects where name like '%/up.jpg' returning 1) select 'lead deletes own unsaved upload:', count(*) from x;
with x as (delete from storage.objects where name like '%/m1.jpg' returning 1) select 'lead deletes a saved file:', count(*) from x;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false) \g /dev/null
\echo EXPECT ERROR crew who leads nothing uploading:
insert into storage.objects(bucket_id,name,owner) values ('snow-media','c0000000-0000-0000-0000-000000000001/completion/70000000-0000-0000-0000-000000000002/n.jpg','00000000-0000-0000-0000-00000000000d');
reset role;

-- Removing a shared item stops sharing it; history is kept.
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
select 'remove shared m1 (changed):', snow_review_media(array['80000000-0000-0000-0000-000000000001']::uuid[], 'removed', 'Shows a neighbor''s car');
select 'm1 share history (shared, then revoked):', count(*), count(revoked_at), max(revoke_reason) from snow_media_shares where media_id='80000000-0000-0000-0000-000000000001';
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false) \g /dev/null
select 'customer items after removal:', max(jsonb_array_length(media)) from snow_customer_history();
select 'customer files after removal:', count(*) from storage.objects where bucket_id='snow-media';
reset role;

-- Re-approve and share again, then end and reopen the storm: nothing is
-- re-shared and nothing new appears for the customer.
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
select snow_review_media(array['80000000-0000-0000-0000-000000000001']::uuid[], 'approved') \g /dev/null
select 'share m1 again after re-approval:', snow_share_media(array['80000000-0000-0000-0000-000000000001']::uuid[]);
update snow_storms set status='ended' where id='50000000-0000-0000-0000-000000000001';
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \g /dev/null
select 'lead files after the storm ended:', count(*) from storage.objects where bucket_id='snow-media';
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
update snow_storms set status='dispatched' where id='50000000-0000-0000-0000-000000000001';
select 'after reopen: share rows / open shares / shared items:', (select count(*) from snow_media_shares), (select count(*) from snow_media_shares where revoked_at is null), (select count(*) from snow_completion_media where shared_at is not null);
select 'unshare m1 (changed):', snow_unshare_media(array['80000000-0000-0000-0000-000000000001']::uuid[], 'Sent by mistake');
select 'm1 stays approved after unshare:', review_status, shared_at is null from snow_completion_media where id='80000000-0000-0000-0000-000000000001';
select 'activity log media events:', string_agg(action, ',' order by occurred_at, action) from snow_activity_events where action like 'media.%' and action <> 'media.uploaded';
reset role;

\echo EXPECT ERROR deleting share history even with full database access:
delete from snow_media_shares;
\echo EXPECT ERROR deleting completion media even with full database access:
delete from snow_completion_media where id='80000000-0000-0000-0000-000000000002';
