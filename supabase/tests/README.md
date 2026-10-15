# Database tests

`006_company_resources_test.sql` runs the Company Resources acceptance
scenarios (grant, reveal, revoke, deactivate, guessed ids, card guard, audit
log) against a plain local Postgres with small Supabase stand-ins.

```sh
createdb t
psql -d t -f supabase/tests/supabase_stubs.sql     # auth, storage, vault, roles
psql -d t -f supabase/schema.sql
grep -v supabase_vault supabase/updates/006_company_resources.sql | psql -d t
psql -d t -f supabase/tests/006_company_resources_test.sql
```

The Vault stand-in stores codes in plain text; real Supabase Vault encrypts
them. Read the output: each step prints what the user could see or the error
they got.

`012_recurring_schedules_test.sql` checks repeating schedules: days filled in
8 weeks ahead, a day the worker is already on the job is skipped, re-running
adds nothing, a cancelled day stays cancelled, monthly repeats on the 31st land
on the last day of short months, and workers can't create or change repeats.

```sh
psql -d t -f supabase/updates/012_recurring_schedules.sql
psql -d t -f supabase/tests/012_recurring_schedules_test.sql
```

`014_crews_test.sql` checks crews: names are unique per company, a worker is
in at most one crew, deleting a crew frees its members, and workers can see
but not change crews.

```sh
psql -d t -f supabase/updates/014_crews.sql
psql -d t -f supabase/tests/014_crews_test.sql
```

`snow_onboarding_test.sql` checks the separate Snow signup code: regenerate
and turn off, a pending applicant sees nothing, an old code stops working
while waiting requests stay, an existing landscaping worker asks with the same
account, approve with services, decline, remove, change services and revoke
(landscaping access untouched). Run after update 020 (Snow access, PR #22) or
the small stand-in here:

```sh
psql -d t -f supabase/tests/snow_roles_standin.sql   # or 020_snow_access.sql
psql -d t -f supabase/updates/snow_onboarding.sql
psql -d t -f supabase/tests/snow_onboarding_test.sql
```
