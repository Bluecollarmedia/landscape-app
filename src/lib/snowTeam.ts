/**
 * Snow Team helpers: which existing landscaping workers the owner can offer
 * Snow access to, and how many past requests to show at a time. Pure functions.
 */

export interface TeamMemberLike {
  personId: string;
  role: string;
  status: string;
  person?: { firstName: string; lastName: string; email?: string };
}

export interface SnowMemberLike {
  personId: string;
  status: 'active' | 'revoked' | string;
}

/**
 * Active landscaping workers who are not on the Snow team yet (neither active
 * nor removed; a removed worker is restored from the Snow team list instead).
 * Owners and admins already have every snow service, so they are not offered.
 */
export function workersToOfferSnow<T extends TeamMemberLike>(members: T[], snowMembers: SnowMemberLike[]): T[] {
  const onSnow = new Set(snowMembers.map((m) => m.personId));
  const seen = new Set<string>();
  return members
    .filter((m) => m.role === 'worker' && m.status === 'active' && !!m.person && !onSnow.has(m.personId))
    .filter((m) => (seen.has(m.personId) ? false : (seen.add(m.personId), true)))
    .sort((a, b) => `${a.person!.lastName} ${a.person!.firstName}`.localeCompare(`${b.person!.lastName} ${b.person!.firstName}`));
}

export const HISTORY_PAGE = 10;

/** The first `pages` pages of a newest-first list, and whether more remain. */
export function pageOf<T>(items: T[], pages: number, size = HISTORY_PAGE): { shown: T[]; more: number } {
  const shown = items.slice(0, pages * size);
  return { shown, more: items.length - shown.length };
}
