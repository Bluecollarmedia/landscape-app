/**
 * "Add an existing customer to Snow": which customers can be offered, which of
 * their addresses are already known to the app (landscaping projects and
 * maintenance properties), and whether a Snow property already exists at an
 * address. Pure functions; nothing here writes anything.
 */

export interface CustomerMemberLike {
  personId: string;
  role: string;
  status: string;
  person?: { firstName: string; lastName: string; email?: string; phone?: string };
}

export interface KnownPlace {
  /** Where the app already knows this address from. */
  source: 'project' | 'maintenance';
  sourceId: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface PlaceRowLike {
  id: string;
  name?: string;
  customerId?: string;
  customerClaimedBy?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  isActive?: boolean;
  status?: string;
}

/** Customers with an account or an invitation (what a Snow contact link needs), sorted by name. */
export function customersToOffer<T extends CustomerMemberLike>(members: T[]): T[] {
  const seen = new Set<string>();
  return members
    .filter((m) => m.role === 'customer' && (m.status === 'active' || m.status === 'invited') && !!m.person)
    .filter((m) => (seen.has(m.personId) ? false : (seen.add(m.personId), true)))
    .sort((a, b) => `${a.person!.lastName} ${a.person!.firstName}`.localeCompare(`${b.person!.lastName} ${b.person!.firstName}`));
}

const SUFFIXES: Record<string, string> = {
  st: 'street', str: 'street', ave: 'avenue', av: 'avenue', rd: 'road', dr: 'drive', ln: 'lane', ct: 'court',
  blvd: 'boulevard', cir: 'circle', pl: 'place', ter: 'terrace', pkwy: 'parkway', hwy: 'highway', trl: 'trail',
  n: 'north', s: 'south', e: 'east', w: 'west',
};

/** An address in a form two spellings of it share ("205 Kathy Ln." and "205 kathy lane" match). */
export function normalizeAddress(address?: string): string {
  return (address ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SUFFIXES[w] ?? w)
    .join(' ');
}

/** Addresses already on file for this customer, one per distinct street address (projects first). */
export function knownPlacesFor(personId: string, projects: PlaceRowLike[], maintenanceProperties: PlaceRowLike[]): KnownPlace[] {
  const out: KnownPlace[] = [];
  const seen = new Set<string>();
  const add = (source: KnownPlace['source'], r: PlaceRowLike) => {
    const key = normalizeAddress(r.address);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ source, sourceId: r.id, name: r.name || r.address || '', address: r.address!.trim(), city: r.city, state: r.state, zip: r.zip });
  };
  for (const p of projects) {
    if ((p.customerId === personId || p.customerClaimedBy === personId) && p.status !== 'archived') add('project', p);
  }
  for (const p of maintenanceProperties) {
    if (p.customerId === personId && p.isActive !== false) add('maintenance', p);
  }
  return out;
}

export interface SnowPropertyLike { id: string; name: string; address?: string; zip?: string }

/** A Snow property already at this street address (and ZIP, when both have one). */
export function findSnowPropertyAt<T extends SnowPropertyLike>(address: string, zip: string | undefined, snowProperties: T[]): T | undefined {
  const key = normalizeAddress(address);
  if (!key) return undefined;
  return snowProperties.find((p) => {
    if (normalizeAddress(p.address) !== key) return false;
    const a = (zip ?? '').slice(0, 5);
    const b = (p.zip ?? '').slice(0, 5);
    return !a || !b || a === b;
  });
}

/** The name for a new Snow property made from a known place. */
export function snowNameFor(place: Pick<KnownPlace, 'name' | 'address'>, customerLastName?: string): string {
  const n = place.name.trim();
  if (n && normalizeAddress(n) !== normalizeAddress(place.address)) return n;
  return customerLastName?.trim() ? `${customerLastName.trim()} Residence` : place.address;
}
