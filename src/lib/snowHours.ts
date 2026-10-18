/**
 * Owner "Snow hours" logic: filter shifts, group them by worker and day, add up
 * time, and flag very short shifts for review. Read-only: nothing here changes
 * a recorded time. Pure functions so they can be checked without the app.
 */

export interface HoursShift {
  id: string;
  personId: string;
  /** The times that count (the latest correction, else the tapped times). */
  clockInAt: string;
  clockOutAt?: string;
  corrected: boolean;
}

/** A finished shift shorter than this is probably an accidental tap and is flagged for the owner to check. */
export const SHORT_SHIFT_MINUTES = 5;

export function shiftMs(s: Pick<HoursShift, 'clockInAt' | 'clockOutAt'>, now = Date.now()): number {
  const end = s.clockOutAt ? new Date(s.clockOutAt).getTime() : now;
  return Math.max(0, end - new Date(s.clockInAt).getTime());
}

/**
 * Flagged for review: finished, shorter than the limit, and not already
 * corrected by the owner (a corrected shift has been looked at).
 */
export function isShortShift(s: HoursShift, minutes = SHORT_SHIFT_MINUTES): boolean {
  return !!s.clockOutAt && !s.corrected && shiftMs(s) < minutes * 60_000;
}

/** Local calendar day of a time, "YYYY-MM-DD". */
export function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface HoursFilters {
  personId?: string;
  /** Inclusive local days, "YYYY-MM-DD". Compared with the day the shift started. */
  fromDay?: string;
  toDay?: string;
  /** Shifts that overlap this period (a storm's dispatch to end; `end` missing = still going). */
  window?: { start: string; end?: string };
  onlyNeedsReview?: boolean;
}

export function filterShifts<T extends HoursShift>(shifts: T[], f: HoursFilters, now = Date.now()): T[] {
  return shifts.filter((s) => {
    if (f.personId && s.personId !== f.personId) return false;
    const day = dayKeyOf(s.clockInAt);
    if (f.fromDay && day < f.fromDay) return false;
    if (f.toDay && day > f.toDay) return false;
    if (f.window) {
      const start = new Date(s.clockInAt).getTime();
      const end = s.clockOutAt ? new Date(s.clockOutAt).getTime() : now;
      const ws = new Date(f.window.start).getTime();
      const we = f.window.end ? new Date(f.window.end).getTime() : now;
      if (end < ws || start > we) return false;
    }
    if (f.onlyNeedsReview && !isShortShift(s)) return false;
    return true;
  });
}

export interface DayGroup<T> { dayKey: string; shifts: T[]; ms: number; needsReview: number }
export interface WorkerGroup<T> { personId: string; name: string; ms: number; needsReview: number; days: DayGroup<T>[] }

/** Worker groups (most hours first), each with its days (newest first). */
export function groupByWorkerDay<T extends HoursShift>(shifts: T[], nameOf: (personId: string) => string, now = Date.now()): WorkerGroup<T>[] {
  const workers = new Map<string, Map<string, T[]>>();
  for (const s of shifts) {
    const days = workers.get(s.personId) ?? new Map<string, T[]>();
    const key = dayKeyOf(s.clockInAt);
    days.set(key, [...(days.get(key) ?? []), s]);
    workers.set(s.personId, days);
  }
  const out: WorkerGroup<T>[] = [];
  for (const [personId, days] of workers) {
    const dayGroups: DayGroup<T>[] = [...days.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([dayKey, list]) => ({
        dayKey,
        shifts: [...list].sort((a, b) => (a.clockInAt < b.clockInAt ? -1 : 1)),
        ms: list.reduce((t, s) => t + shiftMs(s, now), 0),
        needsReview: list.filter((s) => isShortShift(s)).length,
      }));
    out.push({
      personId,
      name: nameOf(personId),
      ms: dayGroups.reduce((t, d) => t + d.ms, 0),
      needsReview: dayGroups.reduce((t, d) => t + d.needsReview, 0),
      days: dayGroups,
    });
  }
  return out.sort((a, b) => b.ms - a.ms);
}

/** Local Monday of the week containing `now` plus `weeksBack` weeks, "YYYY-MM-DD". */
export function weekStartDay(now = new Date(), weeksBack = 0): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - weeksBack * 7);
  return dayKeyOf(d.toISOString());
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return dayKeyOf(x.toISOString());
}
