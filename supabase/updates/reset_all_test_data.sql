-- ============================================================================
-- ⚠️  RESET — DELETES EVERYTHING. Run only to start over with an empty app.
--
-- Wipes every company, project, worker, customer, schedule, message and
-- every login (all accounts must sign up again). Uploaded photo files stay in
-- Storage → media; delete that folder there if you want them gone too.
--
-- Run in Supabase → SQL Editor. There is no undo.
-- ============================================================================

begin;
  -- Companies are protected from deletion; this script is the one exception.
  set local app.allow_company_delete = 'on';

  delete from public.companies;   -- removes everything that belongs to a company
  delete from public.people;      -- every person record
  delete from auth.users;         -- every login
commit;

select 'Reset done. Open the app and tap Create a Company.' as result;
