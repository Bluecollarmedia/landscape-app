import type { SnowTarget } from '@/data/snowDashboard';

/**
 * Where a Snow dashboard item opens. One place, so the storm, route and visit
 * screens (built in their own threads) only need to be wired here.
 *
 * Returns undefined when the destination screen doesn't exist yet. The
 * dashboard then shows the item without a tap target rather than linking to
 * a screen that isn't there.
 */
export function snowDashboardHref(target: SnowTarget): string | undefined {
  switch (target.kind) {
    case 'employee':
      return `/(owner)/(tabs)/workers/${target.personId}`;
    case 'storm':
    case 'route':
    case 'visit':
      // TODO(snow): storm detail / route review / visit screens, under /snow/owner/... (e.g. /snow/owner/storm/<id>).
      return undefined;
  }
}
