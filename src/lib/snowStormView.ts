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
