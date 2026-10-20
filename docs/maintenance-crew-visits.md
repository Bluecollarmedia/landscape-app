# Maintenance: crew visits, leader check-in and estimated labor-hours (update 68)

Three separate records, never mixed up:

1. **Employee workday** (`time_workdays`): each person clocks in and out for their own day (updates 63 and 67). Payroll comes from here.
2. **Property visit** (`time_visits`, `crew_level`): ONE per maintenance stop. The route's crew leader taps I'M HERE (saves the arrival time) and
   FINISH STOP (saves the completion time). Elapsed time = completion - arrival, both stamped by the server.
3. **Estimated labor-hours** (derived, never stored): for each worker assigned to the route (crew + leader), the minutes their own workday
   overlapped the visit, added up. Someone who clocks out half way contributes only the part before their clock-out. Three people for 40
   minutes = 40 minutes elapsed and 120 minutes (2.0 labor-hours) estimated; if one leaves at minute 20 it is 100 minutes.

Rules (enforced by the database):
* Only the route's leader (`maintenance_routes.lead_person_id`) or an owner/admin checks the crew in and finishes a stop. A route with no
  leader named keeps the older rule (any crew member). Other crew members see the status instead of a button.
* The leader must be clocked in to check a crew in. The stop order is the owner's (owner may work out of order; it is written to the history).
* Workers do not start per-person property timers any more for maintenance (the older functions refuse). Landscaping jobs are unchanged.
* A crew visit is never recomputed from intervals and never gets per-person intervals; the owner can correct its arrival/completion time
  (old value, new value and reason are kept).
* A skip request is withdrawn when the crew arrives, and cannot be approved while the crew is at the property.

The owner reads it under Maintenance > a property > Service History: time on site, estimated labor-hours (with who contributed how many minutes),
and a "longer than usual" pointer when a visit is at least 25% and 15 minutes longer than the average of the property's previous five timed
visits. Visits recorded before this update use the stop's own arrival/completion times.

Estimated labor-hours are a trend tool, not payroll, and are labelled that way.
