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

`018_maintenance_test.sql` checks Maintenance: landscaping workers can't be
put on a route or made its lead and can't see maintenance data, crew members
can't change stops directly, start day is recorded once and never blocked by
GPS, a worker can't finish before I'm Here, open checklist items and missing
photos block finishing, crew photos stay internal, a second worker's arrival
is logged separately, finishing twice records one completion, owner
attendance corrections keep the original time, and worked routes/properties
can't be deleted.

```sh
psql -d t -f supabase/updates/018_maintenance.sql
psql -d t -f supabase/tests/018_maintenance_test.sql
```

`020_snow_access_test.sql` checks Snow Mode access: snow-only employees (and
pending or revoked ones) see zero rows in every landscaping table, a
dual-mode worker keeps landscaping, plowing / shoveling / salting are
separate, only the owner can grant or revoke, switching the company to Snow
Mode grants nothing, and grants and revokes are logged once. Run it after all
the other updates so the landscaping sweep covers every table.

```sh
for f in supabase/updates/0*.sql; do grep -v supabase_vault "$f" | psql -d t; done
psql -d t -f supabase/tests/020_snow_access_test.sql
```

`020b_snow_foundation_test.sql` checks the Snow Mode base tables (run 020
first): the same property twice on one route and on another route as separate
visits, a lead must hold the route's service and can lead several routes, lead
reassignment keeps history, no work before dispatch, required photos and
arrival-first block completion, completing one pass leaves the other pending,
completed visits can't be reopened, media can't be replaced or deleted, a
visit is skipped only after its request is approved (denied stays pending),
property edits don't rewrite old visits, ended storms take no new visits until
reopened, draft storms delete cleanly, the activity log is append-only, and
workers/customers see nothing from these tables.

```sh
psql -d t -f supabase/updates/020_snow_access.sql
psql -d t -f supabase/updates/020b_snow_foundation.sql
psql -d t -f supabase/tests/020b_snow_foundation_test.sql
```
