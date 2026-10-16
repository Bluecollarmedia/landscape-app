-- ============================================================================
-- Update 28 — Snow Mode time clock. Run once in Supabase → SQL Editor, after
-- updates 20 (snow access) and 20b (snow foundation). Safe to run again.
--  • One simple shift clock: Clock In at the start, Clock Out at the end.
--    No breaks, and no GPS anywhere.
--  • Every approved snow employee can clock in, lead or not. Clocking in never
--    needs a route, a property or a service, and shows none of them.
--  • Snow shifts live in their own table. Landscaping time (work_sessions,
--    check_ins/check_outs) is untouched, and landscaping hours/payroll screens
--    never read snow shifts.
--  • A repeated tap or a retry after a dropped connection never makes a
--    second shift: each person has at most one open shift, and the app sends
--    a request id that is honoured once.
--  • The owner/admin corrects mistakes with a reason. The times the employee
--    actually tapped stay on the shift (recorded_clock_in_at /
--    recorded_clock_out_at) and every correction is kept, append-only, in
--    snow_shift_corrections with who, when, why, and before/after values.
--    A mistaken shift is voided, never deleted.
--  • Each clock in, clock out, correction and void is written to the snow
--    activity log (snow_log_event from update 20b).
-- ============================================================================

-- ── Shifts ──────────────────────────────────────────────────────────────────

create table if not exists public.snow_shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  -- Current times (after any owner correction). Hours are worked from these.
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  -- What the employee actually tapped. Never changed by a correction.
  recorded_clock_in_at timestamptz not null,
  recorded_clock_out_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed', 'voided')),
  clock_in_request_id uuid unique,
  clock_out_request_id uuid unique,
  correction_count int not null default 0,
  last_corrected_at timestamptz,
  last_corrected_by uuid references public.people(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at > clock_in_at),
  check (status <> 'open' or clock_out_at is null),
  check (status <> 'closed' or clock_out_at is not null)
);
create index if not exists idx_snow_shifts_company_time on public.snow_shifts (company_id, clock_in_at desc);
create index if not exists idx_snow_shifts_person_time on public.snow_shifts (person_id, clock_in_at desc);
-- One open shift per person: a double tap can't start two.
create unique index if not exists snow_shifts_one_open
  on public.snow_shifts (company_id, person_id) where status = 'open';

drop trigger if exists snow_shifts_updated_at on public.snow_shifts;
create trigger snow_shifts_updated_at before update on public.snow_shifts
  for each row execute function public.set_updated_at();

-- ── Corrections (append-only) ───────────────────────────────────────────────

create table if not exists public.snow_shift_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  shift_id uuid not null references public.snow_shifts(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,  -- whose shift
  kind text not null check (kind in ('times', 'void')),
  reason text not null check (length(trim(reason)) > 0),
  before jsonb not null,  -- {clock_in_at, clock_out_at, status}
  after jsonb not null,
  corrected_by uuid references public.people(id) on delete set null,
  corrected_at timestamptz not null default now()
);
create index if not exists idx_snow_shift_corrections_shift on public.snow_shift_corrections (shift_id, corrected_at);

-- ── History guards ──────────────────────────────────────────────────────────
-- Even server code can't rewrite what the employee tapped, reopen a finished
-- shift, or delete a shift or correction. Deleting the whole company or the
-- person's account (cascade) still works.

create or replace function public.snow_shift_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.companies where id = old.company_id)
       and exists (select 1 from public.people where id = old.person_id) then
      raise exception 'Snow time records can''t be deleted. Void the shift instead.';
    end if;
    return old;
  end if;
  if new.company_id <> old.company_id or new.person_id <> old.person_id
     or new.recorded_clock_in_at <> old.recorded_clock_in_at
     or new.clock_in_request_id is distinct from old.clock_in_request_id then
    raise exception 'The recorded clock-in can''t be changed.';
  end if;
  if old.recorded_clock_out_at is not null
     and new.recorded_clock_out_at is distinct from old.recorded_clock_out_at then
    raise exception 'The recorded clock-out can''t be changed.';
  end if;
  if old.status = 'voided' then
    raise exception 'This shift was voided and can''t be changed.';
  end if;
  if old.status = 'closed' and new.status = 'open' then
    raise exception 'A finished shift can''t be reopened.';
  end if;
  return new;
end;
$$;
drop trigger if exists snow_shifts_guard on public.snow_shifts;
create trigger snow_shifts_guard before update or delete on public.snow_shifts
  for each row execute function public.snow_shift_guard();

create or replace function public.snow_shift_corrections_append_only()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE'
     and not (exists (select 1 from public.companies where id = old.company_id)
              and exists (select 1 from public.people where id = old.person_id)
              and exists (select 1 from public.snow_shifts where id = old.shift_id)) then
    return old;  -- cascade from deleting the company / account
  end if;
  raise exception 'Time corrections are permanent and can''t be changed or deleted.';
end;
$$;
drop trigger if exists snow_shift_corrections_append_only on public.snow_shift_corrections;
create trigger snow_shift_corrections_append_only before update or delete on public.snow_shift_corrections
  for each row execute function public.snow_shift_corrections_append_only();

-- ── Access ──────────────────────────────────────────────────────────────────
-- Read: the owner/admin sees every shift; an employee sees only their own
-- shifts and the corrections made to them. Nobody writes directly: all
-- changes go through the functions below.

alter table public.snow_shifts enable row level security;
alter table public.snow_shift_corrections enable row level security;

drop policy if exists snow_shifts_select on public.snow_shifts;
create policy snow_shifts_select on public.snow_shifts for select
  using (public.is_staff(company_id) or person_id = public.my_person_id());

drop policy if exists snow_shift_corrections_select on public.snow_shift_corrections;
create policy snow_shift_corrections_select on public.snow_shift_corrections for select
  using (public.is_staff(company_id) or person_id = public.my_person_id());

revoke insert, update, delete on public.snow_shifts, public.snow_shift_corrections from anon, authenticated;
grant select on public.snow_shifts, public.snow_shift_corrections to authenticated;

-- ── Clock in / clock out (the employee) ─────────────────────────────────────

-- Starts a shift for the caller, or returns the one already open. Pass the
-- same p_request_id on retries; it is honoured once.
create or replace function public.snow_clock_in(p_company_id uuid, p_request_id uuid default null)
returns public.snow_shifts
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_person_id();
  s public.snow_shifts;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if p_request_id is not null then
    select * into s from public.snow_shifts where clock_in_request_id = p_request_id;
    if found then
      if s.person_id <> me then raise exception 'That request belongs to someone else.'; end if;
      return s;
    end if;
  end if;

  if not public.snow_is_active(p_company_id) then
    raise exception 'You don''t have Snow Mode access. Ask the owner to approve you.';
  end if;

  select * into s from public.snow_shifts
   where company_id = p_company_id and person_id = me and status = 'open';
  if found then return s; end if;

  begin
    insert into public.snow_shifts (company_id, person_id, clock_in_at, recorded_clock_in_at, clock_in_request_id)
    values (p_company_id, me, now(), now(), p_request_id)
    returning * into s;
  exception when unique_violation then
    -- A second tap raced this one: hand back the shift it opened.
    select * into s from public.snow_shifts
     where company_id = p_company_id and person_id = me and status = 'open';
    if found then return s; end if;
    select * into s from public.snow_shifts where clock_in_request_id = p_request_id;
    return s;
  end;

  perform public.snow_log_event(p_company_id, 'shift.clocked_in', 'shift', s.id,
    null, null, null, null, me, null, null,
    jsonb_build_object('clock_in_at', s.clock_in_at), null);
  return s;
end;
$$;

-- Ends the caller's open shift. Works even if their snow access was revoked
-- mid-shift, so nobody is left clocked in. Retries with the same
-- p_request_id return the shift it already closed.
create or replace function public.snow_clock_out(p_company_id uuid, p_request_id uuid default null)
returns public.snow_shifts
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_person_id();
  s public.snow_shifts;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if p_request_id is not null then
    select * into s from public.snow_shifts where clock_out_request_id = p_request_id;
    if found then
      if s.person_id <> me then raise exception 'That request belongs to someone else.'; end if;
      return s;
    end if;
  end if;

  select * into s from public.snow_shifts
   where company_id = p_company_id and person_id = me and status = 'open'
   for update;
  if not found then raise exception 'You''re not clocked in.'; end if;

  update public.snow_shifts
     set clock_out_at = greatest(now(), clock_in_at + interval '1 second'),
         recorded_clock_out_at = now(),
         status = 'closed',
         clock_out_request_id = p_request_id
   where id = s.id
  returning * into s;

  perform public.snow_log_event(p_company_id, 'shift.clocked_out', 'shift', s.id,
    null, null, null, null, me, null, null,
    jsonb_build_object('clock_in_at', s.clock_in_at, 'clock_out_at', s.clock_out_at), null);
  return s;
end;
$$;

-- ── Corrections (owner/admin) ───────────────────────────────────────────────

-- Sets a shift's clock-in and clock-out. p_clock_out_at may be null only for a
-- shift that is still open (leave it running); giving one closes it, which is
-- how the owner finishes a shift someone forgot to clock out of.
create or replace function public.snow_correct_shift(
  p_shift_id uuid,
  p_clock_in_at timestamptz,
  p_clock_out_at timestamptz,
  p_reason text
) returns public.snow_shifts
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_person_id();
  s public.snow_shifts;
  b jsonb;
  a jsonb;
  new_status text;
begin
  select * into s from public.snow_shifts where id = p_shift_id for update;
  if not found or not public.is_staff(s.company_id) then
    raise exception 'Only the owner or an admin can correct time.';
  end if;
  if s.status = 'voided' then raise exception 'This shift was voided and can''t be changed.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Add a reason for the correction.'; end if;
  if p_clock_in_at is null then raise exception 'Enter a clock-in time.'; end if;
  if p_clock_out_at is null and s.status = 'closed' then raise exception 'Enter a clock-out time.'; end if;
  if p_clock_out_at is not null and p_clock_out_at <= p_clock_in_at then
    raise exception 'Clock-out must be after clock-in.';
  end if;
  if p_clock_in_at > now() + interval '5 minutes' or p_clock_out_at > now() + interval '5 minutes' then
    raise exception 'Times can''t be in the future.';
  end if;
  if p_clock_in_at = s.clock_in_at and p_clock_out_at is not distinct from s.clock_out_at then
    raise exception 'Nothing changed.';
  end if;
  if exists (
    select 1 from public.snow_shifts o
     where o.company_id = s.company_id and o.person_id = s.person_id and o.id <> s.id
       and o.status <> 'voided'
       and tstzrange(o.clock_in_at, coalesce(o.clock_out_at, 'infinity'))
           && tstzrange(p_clock_in_at, coalesce(p_clock_out_at, 'infinity'))
  ) then
    raise exception 'Those times overlap another shift for this person.';
  end if;

  new_status := case when p_clock_out_at is null then 'open' else 'closed' end;
  b := jsonb_build_object('clock_in_at', s.clock_in_at, 'clock_out_at', s.clock_out_at, 'status', s.status);
  a := jsonb_build_object('clock_in_at', p_clock_in_at, 'clock_out_at', p_clock_out_at, 'status', new_status);

  insert into public.snow_shift_corrections (company_id, shift_id, person_id, kind, reason, before, after, corrected_by)
  values (s.company_id, s.id, s.person_id, 'times', trim(p_reason), b, a, me);

  update public.snow_shifts
     set clock_in_at = p_clock_in_at,
         clock_out_at = p_clock_out_at,
         status = new_status,
         correction_count = correction_count + 1,
         last_corrected_at = now(),
         last_corrected_by = me
   where id = s.id
  returning * into s;

  perform public.snow_log_event(s.company_id, 'shift.corrected', 'shift', s.id,
    null, null, null, null, s.person_id, null, b, a, trim(p_reason));
  return s;
end;
$$;

-- Voids a shift that shouldn't count (an accidental clock-in, a duplicate).
-- It stays on record, marked voided, and no longer counts toward hours.
create or replace function public.snow_void_shift(p_shift_id uuid, p_reason text)
returns public.snow_shifts
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_person_id();
  s public.snow_shifts;
  b jsonb;
  a jsonb;
begin
  select * into s from public.snow_shifts where id = p_shift_id for update;
  if not found or not public.is_staff(s.company_id) then
    raise exception 'Only the owner or an admin can void a shift.';
  end if;
  if s.status = 'voided' then raise exception 'This shift is already voided.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Add a reason for voiding this shift.'; end if;

  b := jsonb_build_object('clock_in_at', s.clock_in_at, 'clock_out_at', s.clock_out_at, 'status', s.status);
  a := b || jsonb_build_object('status', 'voided');

  insert into public.snow_shift_corrections (company_id, shift_id, person_id, kind, reason, before, after, corrected_by)
  values (s.company_id, s.id, s.person_id, 'void', trim(p_reason), b, a, me);

  update public.snow_shifts
     set status = 'voided', voided_at = now(), voided_by = me,
         correction_count = correction_count + 1, last_corrected_at = now(), last_corrected_by = me
   where id = s.id
  returning * into s;

  perform public.snow_log_event(s.company_id, 'shift.voided', 'shift', s.id,
    null, null, null, null, s.person_id, null, b, a, trim(p_reason));
  return s;
end;
$$;

-- ── Owner review ────────────────────────────────────────────────────────────

-- Shifts that started in [p_from, p_to), with the employee's name and worked
-- minutes (open shifts count up to now; voided shifts count zero).
-- Owner/admin only.
create or replace function public.snow_time_records(p_company_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  shift_id uuid,
  person_id uuid,
  person_name text,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  recorded_clock_in_at timestamptz,
  recorded_clock_out_at timestamptz,
  status text,
  worked_minutes numeric,
  correction_count int,
  last_corrected_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_company_id) then
    raise exception 'Only the owner or an admin can review snow time.';
  end if;
  return query
    select s.id, s.person_id,
           nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
           s.clock_in_at, s.clock_out_at, s.recorded_clock_in_at, s.recorded_clock_out_at, s.status,
           case when s.status = 'voided' then 0::numeric
                else round(extract(epoch from (coalesce(s.clock_out_at, now()) - s.clock_in_at)) / 60, 1) end,
           s.correction_count, s.last_corrected_at
      from public.snow_shifts s
      join public.people p on p.id = s.person_id
     where s.company_id = p_company_id
       and s.clock_in_at >= p_from and s.clock_in_at < p_to
     order by s.clock_in_at desc;
end;
$$;

revoke all on function public.snow_clock_in(uuid, uuid) from public, anon;
revoke all on function public.snow_clock_out(uuid, uuid) from public, anon;
revoke all on function public.snow_correct_shift(uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.snow_void_shift(uuid, text) from public, anon;
revoke all on function public.snow_time_records(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.snow_clock_in(uuid, uuid) to authenticated;
grant execute on function public.snow_clock_out(uuid, uuid) to authenticated;
grant execute on function public.snow_correct_shift(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.snow_void_shift(uuid, text) to authenticated;
grant execute on function public.snow_time_records(uuid, timestamptz, timestamptz) to authenticated;

-- ── Live updates ────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['snow_shifts', 'snow_shift_corrections'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
