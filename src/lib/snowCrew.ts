/**
 * Crew on a Snow route (update 41). A route has one lead and can also have crew
 * members. Crew can view the route; only the lead can act on it. Pure helpers.
 */

export type RouteRole = 'lead' | 'crew';

export interface PersonChoice { personId: string; name: string }

/** Only the lead can mark arrival, finish stops, add photos or ask to skip. Crew view only. */
export function canWorkRoute(role: RouteRole | undefined): boolean {
  return role !== 'crew';
}

/** People the owner can still add as crew: eligible for the route's service, not the lead, not already crew. */
export function crewChoices(eligible: PersonChoice[], leadPersonId: string | undefined, crewIds: string[]): PersonChoice[] {
  const taken = new Set(crewIds);
  const seen = new Set<string>();
  return eligible
    .filter((p) => p.personId !== leadPersonId && !taken.has(p.personId))
    .filter((p) => (seen.has(p.personId) ? false : (seen.add(p.personId), true)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The crew list after adding or removing one person (no repeats, order kept). */
export function nextCrew(current: string[], personId: string, add: boolean): string[] {
  if (add) return current.includes(personId) ? current : [...current, personId];
  return current.filter((id) => id !== personId);
}

/** "No crew", "1 crew member", "3 crew members". */
export function crewCountLabel(n: number): string {
  if (n <= 0) return 'No crew';
  return `${n} crew ${n === 1 ? 'member' : 'members'}`;
}

/** Short tag for a storm's route row: "+2 crew", or nothing when there is none. */
export function crewTag(n: number): string {
  return n > 0 ? `+${n} crew` : '';
}

/** Which role shows for a route: the database's answer, or lead for databases without update 41 (only leads can see routes there). */
export function roleFor(roles: Map<string, RouteRole> | null, routeId: string): RouteRole {
  return roles?.get(routeId) ?? 'lead';
}
