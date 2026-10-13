/**
 * Repeating schedules: which days a weekly / every-2-weeks / monthly repeat
 * lands on. Mirrors extend_schedule_series() in supabase/updates/012 (used
 * directly in demo mode and for the preview on Schedule Work).
 */
import type { RepeatFrequency } from '@/types/schedule';

/** How far ahead a repeat's days are filled in. Matches the database default. */
export const SERIES_HORIZON_DAYS = 56;

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDaysKey(key: string, days: number): string {
  const d = parseKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

/** Same day of the month `months` later; the 31st becomes the last day of a
 * shorter month (like Postgres date + interval). */
export function addMonthsKey(key: string, months: number): string {
  const d = parseKey(key);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toKey(target);
}

function nthDate(frequency: RepeatFrequency, startDate: string, n: number): string {
  if (frequency === 'weekly') return addDaysKey(startDate, 7 * n);
  if (frequency === 'biweekly') return addDaysKey(startDate, 14 * n);
  return addMonthsKey(startDate, n);
}

/** Days the repeat lands on from `from` through `to` (inclusive), never past
 * its end date. At most `limit` days. */
export function occurrenceDates(
  s: { frequency: RepeatFrequency; startDate: string; endDate?: string },
  from: string,
  to: string,
  limit = 500,
): string[] {
  const last = s.endDate && s.endDate < to ? s.endDate : to;
  const out: string[] = [];
  for (let n = 0; out.length < limit; n++) {
    const d = nthDate(s.frequency, s.startDate, n);
    if (d > last) break;
    if (d >= from) out.push(d);
  }
  return out;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Every 2 weeks on Monday", "Every week on Friday", "Monthly on the 12th". */
export function describeRepeat(frequency: RepeatFrequency, startDate: string): string {
  const d = parseKey(startDate);
  const weekday = WEEKDAYS[d.getUTCDay()];
  if (frequency === 'weekly') return `Every week on ${weekday}`;
  if (frequency === 'biweekly') return `Every 2 weeks on ${weekday}`;
  return `Monthly on the ${ordinal(d.getUTCDate())}`;
}

/** Short form for badges: "Weekly", "Every 2 weeks", "Monthly". */
export function repeatShortLabel(frequency: RepeatFrequency): string {
  return frequency === 'weekly' ? 'Weekly' : frequency === 'biweekly' ? 'Every 2 weeks' : 'Monthly';
}
