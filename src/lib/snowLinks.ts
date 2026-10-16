import type { Href } from 'expo-router';
import type { SnowTarget } from '@/data/snowDashboard';

/**
 * Where a Snow dashboard item opens. Visits open their route, where the stop
 * is listed in order; there's no separate visit screen. Employees open Snow
 * Hours, the owner's view of snow shifts.
 */
export function snowDashboardHref(target: SnowTarget): Href {
  switch (target.kind) {
    case 'storm':
      return { pathname: '/snow/owner/storm/[id]', params: { id: target.stormId } };
    case 'route':
    case 'visit':
      return { pathname: '/snow/owner/route/[id]', params: { id: target.routeId } };
    case 'employee':
      return '/snow/owner/hours';
    case 'media_review':
      return '/snow/owner/review';
  }
}
