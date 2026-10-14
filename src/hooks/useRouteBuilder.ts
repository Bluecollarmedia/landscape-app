import { useCallback, useMemo } from 'react';
import { db, useDb } from '@/data/store';
import type { PersonSummary } from '@/types/company';
import type { Crew } from '@/types/crew';

/**
 * Everything the owner's New Route screen reads and writes, in one place, so
 * the screen doesn't depend on how the maintenance tables are laid out.
 *
 * TODO(maintenance data model): wire candidates/createRoute to the shared
 * maintenance tables and due/overdue logic once they land.
 */

export type DueState = 'overdue' | 'due' | 'upcoming' | 'unknown';

export interface CandidateService {
  /** The contract service this visit would cover. */
  serviceId: string;
  name: string;
  state: DueState;
  dueDate?: string;
  lastServiceDate?: string;
  daysOverdue?: number;
  completedCount?: number;
  /** Seasonal quantity, e.g. 26 cuts. */
  seasonTarget?: number;
}

export interface RouteCandidate {
  propertyId: string;
  label: string;
  address: string;
  customerName?: string;
  /** Standing property notes, shown so the owner doesn't repeat them per stop. */
  accessNotes?: string;
  services: CandidateService[];
  /** The most urgent of its services. */
  urgency: DueState;
  /** Days overdue of its most overdue service (0 when none is overdue). */
  maxDaysOverdue: number;
  /** Already a stop on another route that date. */
  alreadyRouted: boolean;
}

export interface StopDraft {
  propertyId: string;
  serviceIds: string[];
  instructions: string;
  checklist: string[];
  photoRequired: boolean;
}

export interface RouteDraft {
  serviceDate: string;
  notes: string;
  stops: StopDraft[];
  crewId: string | null;
  crewPersonIds: string[];
  leadPersonId: string | null;
}

export interface MaintenanceCrewInfo {
  crew?: Crew;
  /** Approved, active maintenance workers in that crew. */
  members: PersonSummary[];
}

const URGENCY_RANK: Record<DueState, number> = { overdue: 0, due: 1, upcoming: 2, unknown: 3 };

/** Overdue first (most overdue on top), then due, upcoming, and not configured. */
export function sortCandidates(list: RouteCandidate[]): RouteCandidate[] {
  return [...list].sort((a, b) =>
    URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
    b.maxDaysOverdue - a.maxDaysOverdue ||
    a.label.localeCompare(b.label));
}

export function useRouteBuilder(serviceDate: string) {
  const v = useDb();

  const candidates = useMemo<RouteCandidate[]>(() => sortCandidates([]), [v, serviceDate]);

  const maintenanceCrew = useMemo<MaintenanceCrewInfo>(() => ({ crew: undefined, members: [] }), [v]);

  const createRoute = useCallback((_draft: RouteDraft): string => {
    throw new Error('Maintenance routes are not connected yet.');
  }, []);

  return { candidates, maintenanceCrew, createRoute };
}

/** Helper for people lookups the screen needs. */
export function personById(id: string): PersonSummary | undefined {
  return db.members.find(m => m.personId === id)?.person;
}
