// Folding a long activity history: today stays open, every earlier day is one tidy line, and earlier months fold into one line.
// Pure, no network.

export interface FoldDay<T> { key: string; events: T[] }
export interface FoldMonth<T> { key: string; days: FoldDay<T>[]; count: number }

/** "2026-10-19" -> "2026-10". */
export const monthKey = (dayKey: string) => dayKey.slice(0, 7);

/** Groups newest-first days into months (newest first). */
export function groupByMonth<T>(days: FoldDay<T>[]): FoldMonth<T>[] {
  const out: FoldMonth<T>[] = [];
  for (const d of days) {
    const key = monthKey(d.key);
    const last = out[out.length - 1];
    if (last?.key === key) { last.days.push(d); last.count += d.events.length; }
    else out.push({ key, days: [d], count: d.events.length });
  }
  return out;
}

/** Today's key in the same local format as the day keys. */
export function todayKey(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole months before the current one start folded; the current month shows its days. */
export const isCurrentMonth = (month: string, now: Date = new Date()) => month === todayKey(now).slice(0, 7);

export function monthHeading(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "6 updates · 2 stops finished" */
export function daySummary(events: { eventType: string }[]): string {
  const finished = events.filter((e) => e.eventType === 'completed').length;
  return finished ? `${plural(events.length, 'update', 'updates')} · ${plural(finished, 'stop finished', 'stops finished')}` : plural(events.length, 'update', 'updates');
}

export function monthSummary(month: FoldMonth<{ eventType: string }>): string {
  const finished = month.days.reduce((n, d) => n + d.events.filter((e) => e.eventType === 'completed').length, 0);
  const base = `${plural(month.days.length, 'day', 'days')} · ${plural(month.count, 'update', 'updates')}`;
  return finished ? `${base} · ${plural(finished, 'stop finished', 'stops finished')}` : base;
}
