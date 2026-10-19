// Small display helpers for the Storm Details screen (pure, no network).
import type { SnowStorm } from '@/types/snow';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "October 19 at 9:43 AM" from a stored timestamp, in the phone's own time zone. Empty for a missing or bad date. */
export function longWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${MONTHS[d.getMonth()]} ${d.getDate()} at ${time}`;
}

export interface HistoryEvent { key: string; label: string; when: string }

/** The storm's timeline, oldest first, from its real stored dates. */
export function historyEvents(storm: Pick<SnowStorm, 'status' | 'createdAt' | 'dispatchedAt' | 'endedAt' | 'reopenedCount' | 'lastReopenedAt'>): HistoryEvent[] {
  const out: HistoryEvent[] = [{ key: 'created', label: 'Created', when: longWhen(storm.createdAt) }];
  if (storm.dispatchedAt) out.push({ key: 'dispatched', label: 'Dispatched', when: longWhen(storm.dispatchedAt) });
  if (storm.reopenedCount > 0) {
    out.push({
      key: 'reopened',
      label: storm.reopenedCount === 1 ? 'Reopened' : `Reopened ${storm.reopenedCount} times, last`,
      when: longWhen(storm.lastReopenedAt),
    });
  }
  if (storm.endedAt) out.push({ key: 'ended', label: storm.status === 'ended' ? 'Ended' : 'Last ended', when: longWhen(storm.endedAt) });
  return out;
}

/** "1 route", "2 routes", "0 routes". */
export function routeCountLabel(n: number | undefined): string {
  const c = n ?? 0;
  return `${c} ${c === 1 ? 'route' : 'routes'}`;
}
