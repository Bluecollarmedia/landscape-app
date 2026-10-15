import { locationLabel } from '@/data/maintenance';
import type { LocationStatus } from '@/types/maintenance';

/** locationLabel() speaks of "the property"; day starts are checked against the yard. */
export function yardLocationLabel(status?: LocationStatus): string {
  if (status === 'outside_radius') return 'Not at the yard (GPS)';
  if (status === 'no_target_location') return 'Yard not on the map';
  return locationLabel(status);
}

/**
 * What to tell a maintenance worker before saving a check-in whose location
 * can't be verified. Null when the reading is verified and nothing needs
 * saying. Check-ins are never blocked: every prompt offers to continue, and
 * the record keeps its real location status so the owner can review it.
 */
export function unverifiedPrompt(
  status: LocationStatus,
  placeName: string,
  kind: 'day' | 'stop',
): { title: string; message: string; openSettings?: boolean } | null {
  const action = kind === 'day' ? 'start your day' : 'check in';
  const tail = `You can still ${action}. It will be saved as not GPS verified so the office can review it.`;
  switch (status) {
    case 'verified':
      return null;
    case 'outside_radius':
      return {
        title: kind === 'day' ? 'You’re not at the yard' : 'You’re not at this property',
        message: `Your phone doesn’t place you at ${placeName}. ${tail}`,
      };
    case 'low_accuracy':
      return { title: 'GPS signal is weak', message: `Your phone can’t tell exactly where you are right now. ${tail}` };
    case 'denied':
      return { title: 'Location is off', message: `Brighton Lawn can’t see your location. ${tail}`, openSettings: true };
    case 'no_target_location':
      return { title: 'Location can’t be checked', message: `${placeName} isn’t pinned on the map yet. ${tail}` };
    case 'unavailable':
    case 'not_checked':
    default:
      return { title: 'Can’t find your location', message: `Your phone couldn’t get a GPS fix. ${tail}` };
  }
}
