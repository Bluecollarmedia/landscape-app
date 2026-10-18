/**
 * Storms can cover several services (update 40). Small pure helpers for the
 * lists of services on a storm and the one service each route performs.
 */

import type { SnowService } from '@/types/snow';

/** The services a storm covers. Storms from before update 40 have only the old single `service`. */
export function stormServices(storm: { service: SnowService; services?: SnowService[] }): SnowService[] {
  return storm.services && storm.services.length ? storm.services : [storm.service];
}

/** "Plowing", "Plowing + Shoveling", "Plowing, Shoveling + Salting". */
export function servicesLabel(services: SnowService[], label: (s: SnowService) => string): string {
  const names = services.map(label);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} + ${names[names.length - 1]}`;
}

/** Add or remove a service from a pick, keeping the order the owner chose them in. */
export function toggleService(picked: SnowService[], s: SnowService): SnowService[] {
  return picked.includes(s) ? picked.filter((x) => x !== s) : [...picked, s];
}

/**
 * Which service a new route should have. A storm with one service decides it;
 * with several the owner must say.
 */
export function routeServiceChoice(
  services: SnowService[],
  picked?: SnowService,
): { needsPick: boolean; service?: SnowService; error?: string } {
  if (services.length === 0) return { needsPick: false, error: 'This storm has no services yet.' };
  if (picked) {
    return services.includes(picked)
      ? { needsPick: false, service: picked }
      : { needsPick: false, error: 'This storm does not include that service.' };
  }
  if (services.length === 1) return { needsPick: false, service: services[0] };
  return { needsPick: true };
}

/** Services the owner may remove from a storm: those with no route yet (the database refuses the rest). */
export function removableServices(services: SnowService[], routeServices: SnowService[]): SnowService[] {
  const used = new Set(routeServices);
  return services.filter((s) => !used.has(s));
}

/** How many routes a storm has for each of its services (cancelled routes included: they are history). */
export function routesPerService(services: SnowService[], routes: { service: SnowService }[]): Record<SnowService, number> {
  const out = { plowing: 0, shoveling: 0, salting: 0 } as Record<SnowService, number>;
  for (const s of services) out[s] = 0;
  for (const r of routes) out[r.service] = (out[r.service] ?? 0) + 1;
  return out;
}

/** A starting name for a new storm, e.g. "Jan 12 Plowing" or, with several services, "Jan 12 Storm". */
export function defaultStormNameFor(services: SnowService[], label: (s: SnowService) => string, now = new Date()): string {
  const day = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (services.length === 1) return `${day} ${services[0] === 'shoveling' ? 'Sidewalks' : label(services[0])}`;
  return `${day} Storm`;
}
