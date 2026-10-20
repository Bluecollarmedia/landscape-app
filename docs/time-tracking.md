# Workday, property-visit and labor tracking

Database updates 063, 064 and 065 (run in that order, after 062). The app works exactly as before until they are run: every new
screen and button checks that the database answers and falls back to the older check-in screens when it does not.

## What it does

* **Workday** (`time_workdays`): one row per employee workday, clock-in at the yard to clock-out. The server stamps the times
  (`now()`); the phone only sends its local calendar date. One open workday per person, enforced by a unique index, even from two phones.
  Breaks (`time_breaks`) exist only when the owner turns break tracking on.
* **Property visit** (`time_visits`): one row per real visit: a maintenance stop, or a landscaping project on one date.
  A recurring property has many visits; a multi-day project has one visit per day worked.
* **Each employee's own time** (`time_intervals`): start and end at a visit. Crew labor = the sum of these. The visit's elapsed time
  (first start to last finish) is a different number and is always labelled differently.
* **Rates**: `time_workday_rates` and `time_interval_rates` hold the hourly rate in force when the work happened (owner-only tables), so a
  raise never rewrites past costs. `time_set_hourly_rate` ends the old rate and adds a new effective-dated one.
* **Route order, skips, photos, one-property-at-a-time, no break mid-visit** are enforced in the database functions
  (`time_start_visit`, `time_complete_visit`, `time_request_skip`, `time_decide_skip`), not only on screen.
* **Corrections** (`time_staff_*`) need a reason, never overwrite silently, and write the old and new value, the person and the time to
  `time_audit` (append-only). Changing an approved day reopens it for approval again.
* **Approval** (`time_approve_workday` / `time_reopen_workday`): only a clocked-out day with nothing running can be approved.
* **Alerts** (`time_alerts`): over target, daily alert hours (approaching / reached), a workday left open, an unusually long visit and
  skip requests. Each is saved once (unique key) so it never repeats. There is no background scheduler: alerts are worked out when a
  worker acts or has the app open (`time_my_day`) and when the owner opens Hours & Labor.

## Who can see what

Workers have no direct access to any `time_*` table. They call functions that return only their own day (no rates, targets, averages,
costs or other people's hours). Owners/admins read their own company's rows through row-level security. Customers and other
companies get nothing. All owner-only decisions are checked in the database, not by hiding buttons.

## Definitions (also in `src/lib/timeCalc.ts`, used by every screen and export)

* Gross workday time = clock-out − clock-in (or now while open). Never an invented end.
* Recorded break time = union of the day's breaks (overlaps counted once). Deducted break time = the unpaid part. Net payable = gross − deducted.
  Nothing is deducted for a break nobody recorded.
* Property labor = one employee's own interval. Crew labor = sum of intervals. Property elapsed = earliest start to latest end.
* Labor cost = interval hours × the rate saved with the interval. Payable cost = net hours × the day's saved rate (+ overtime premium in the weekly view).
* Weeks run Monday to Sunday. Times are real timestamps; hours show to 2 places and money to cents only at display time.
* Averages count completed visits only (not in-progress, voided or skipped). A skip has no time at all and is never "completed".
* Overtime is a calculation from the owner's own settings (Payroll terms), shown with its basis. It is not a legal payroll determination.

## Not built / honest limits

* No offline queue (as requested): an action that cannot reach the database says so and is not saved.
* No "missed clock-in" alert: the app has no reliable company timezone or schedule start to judge it against.
* Existing Hours / Payroll Estimate screens still read the older `work_sessions` (written alongside, so they stay right). The new weekly summary
  reads workdays. They are different measures: job check-in time vs whole-workday time.
* Gaps between visits are labelled "Between visits" / "Before the first visit", never "travel": the app cannot know what the gap was.
* Push delivery uses the existing notification trigger; nothing here proves a push reached a phone.
