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

`022_snow_property_details_test.sql` checks snow property details (run 020,
020b and 022 first; the stubs need a `storage.foldername` stand-in and storage
grants): company ids come from the parent record, one main contact per
property, only customer accounts can be linked, saved instructions and
reference media can't be edited or deleted (even by the owner), a plow lead
sees only plowing instructions/media and files and a shovel lead only
shoveling, crew who lead nothing see none, customers see their property's
name/address and services but no notes, instructions or media, another
company sees nothing, a visit needs the service set up on the property, a
completed visit still shows the instructions version and photos it was done
with after the owner changes them, and an ended storm or revoked service
cuts the lead off.

```sh
psql -d t -f supabase/updates/022_snow_property_details.sql
psql -d t -f supabase/tests/022_snow_property_details_test.sql
```
