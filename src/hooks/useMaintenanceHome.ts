/**
 * What the owner's Maintenance home shows: today's route(s), what's due or
 * overdue, and a couple of counts for the entry points.
 *
 * This is a thin view over the shared Maintenance data hooks, so the home
 * screen doesn't depend on table shapes.
 */

export interface MaintenanceDueItem {
  /** property id + service id, unique per row */
  key: string;
  propertyId: string;
  propertyName: string;
  address?: string | null;
  serviceName: string;
  lastServiceDate: string | null;
  dueDate: string | null;
  /** > 0 overdue by N days, 0 due today, < 0 due in N days */
  daysOverdue: number;
  /** For seasonal quantities like 26 cuts. */
  seasonalCompleted?: number | null;
  seasonalTotal?: number | null;
}

export interface MaintenanceRouteSummary {
  id: string;
  serviceDate: string;
  name?: string | null;
  stopCount: number;
  completedCount: number;
  crewNames: string[];
  checkedInCount: number;
}

export interface MaintenanceHome {
  ready: boolean;
  loadError: string | null;
  activePropertyCount: number;
  dueItems: MaintenanceDueItem[];
  todayRoutes: MaintenanceRouteSummary[];
  refresh: () => Promise<void>;
}

const EMPTY: Omit<MaintenanceHome, 'refresh'> = {
  ready: true,
  loadError: null,
  activePropertyCount: 0,
  dueItems: [],
  todayRoutes: [],
};

const noopRefresh = async () => {};

// TODO(maintenance data model): read from the shared Maintenance hooks once
// that PR lands. Until then the home shows its empty state.
export function useMaintenanceHome(): MaintenanceHome {
  return { ...EMPTY, refresh: noopRefresh };
}
