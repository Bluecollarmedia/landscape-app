-- ============================================================================
-- Update 12 — run once in Supabase → SQL Editor (safe to run again).
--  • Repeating schedules: the owner can schedule a worker on a job weekly,
--    every 2 weeks or monthly, with an optional end date (e.g. the
--    maintenance crew every 2 weeks).
--  • Each repeat is saved in schedule_series. Its days are filled in as normal
--    assignments 8 weeks ahead, so workers confirm and check in as usual.
--    The owner's app tops it up each day it's opened.
--  • A worker is still never put on the same job twice in one day: those days
--    are skipped. A day the owner cancels stays cancelled.
--  • Same access rules as assignments: the crew can see, only the
--    owner/admin can change.
-- ============================================================================

create table if not exists public.schedule_series (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  frequency text not null check (frequency in ('weekly','biweekly','monthly')),
  start_date date not null,
  end_date date,
  start_time text,           -- 'HH:MM' company-local wall clock
  end_time text,
  is_full_day boolean not null default false,
  truck_id uuid references public.trucks(id) on delete set null,
  notes text,
  created_by uuid references public.people(id) on delete set null,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists idx_schedule_series_company on public.schedule_series(company_id);

drop trigger if exists schedule_series_updated_at on public.schedule_series;
create trigger schedule_series_updated_at before update on public.schedule_series
  for each row execute function public.set_updated_at();

alter table public.schedule_series enable row level security;
drop policy if exists schedule_series_select on public.schedule_series;
create policy schedule_series_select on public.schedule_series for select using (public.is_crew(company_id));
drop policy if exists schedule_series_staff on public.schedule_series;
create policy schedule_series_staff on public.schedule_series for all
  using (public.is_staff(company_id)) with check (public.is_staff(company_id));

-- Which repeat filled in this day, if any.
alter table public.assignments
  add column if not exists series_id uuid references public.schedule_series(id) on delete set null;

-- One day per repeat per date, cancelled or not, so a cancelled day isn't
-- filled in again.
create unique index if not exists uq_assignments_series_day
  on public.assignments (series_id, scheduled_date)
  where series_id is not null;

-- Fills in a repeat's days from p_today up to p_horizon_days ahead.
-- p_series = null tops up every running repeat the caller can manage.
-- p_today is the company's local date, passed by the app.
-- Returns how many days were added.
create or replace function public.extend_schedule_series(
  p_series uuid default null,
  p_today date default current_date,
  p_horizon_days integer default 56
)
returns integer language plpgsql set search_path = public as $$
declare
  s public.schedule_series%rowtype;
  d date;
  last_day date;
  n integer;
  new_id uuid;
  added integer := 0;
  label text;
begin
  for s in
    select ss.* from public.schedule_series ss
    join public.projects p on p.id = ss.project_id
    where ss.stopped_at is null
      and (p_series is null or ss.id = p_series)
      and public.is_staff(ss.company_id)
      and p.status = 'active'
      -- Only workers still on the team.
      and exists (
        select 1 from public.company_members m
        where m.company_id = ss.company_id and m.person_id = ss.person_id and m.status = 'active'
      )
  loop
    last_day := least(coalesce(s.end_date, 'infinity'::date), p_today + p_horizon_days);
    label := case when s.is_full_day then 'Full Day' else coalesce(s.start_time, '') || '–' || coalesce(s.end_time, '') end;
    n := 0;
    loop
      d := case s.frequency
        when 'weekly'   then s.start_date + 7 * n
        when 'biweekly' then s.start_date + 14 * n
        else (s.start_date + make_interval(months => n))::date
      end;
      exit when d > last_day;
      if d >= p_today then
        new_id := null;
        -- Skips the day if this repeat already has it (even cancelled) or the
        -- worker is already on this job that day.
        insert into public.assignments (
          company_id, project_id, person_id, scheduled_date, start_time, end_time,
          is_full_day, status, confirmation_state, truck_id, notes, series_id
        ) values (
          s.company_id, s.project_id, s.person_id, d,
          case when s.is_full_day then null else s.start_time end,
          case when s.is_full_day then null else s.end_time end,
          s.is_full_day, 'scheduled', 'awaiting', s.truck_id, s.notes, s.id
        )
        on conflict do nothing
        returning id into new_id;

        if new_id is not null then
          added := added + 1;
          insert into public.schedule_changes (company_id, assignment_id, changed_by, change_type, new_value, notes)
          values (
            s.company_id, new_id, public.my_person_id(), 'created',
            jsonb_build_object('project', (select name from public.projects where id = s.project_id), 'time', label)::text,
            'Repeating schedule'
          );
        end if;
      end if;
      n := n + 1;
    end loop;
  end loop;
  return added;
end;
$$;

revoke execute on function public.extend_schedule_series(uuid, date, integer) from public, anon;
grant execute on function public.extend_schedule_series(uuid, date, integer) to authenticated;

-- Live updates
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule_series'
  ) then
    alter publication supabase_realtime add table public.schedule_series;
  end if;
end $$;
