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
