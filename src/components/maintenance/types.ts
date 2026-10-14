import type { Place } from '@/lib/maps';

/**
 * What the maintenance worker screens draw for one route stop. This is a
 * display shape only: the stored records (route, stop/visit, arrival and
 * completion events) live in the maintenance data model, and
 * useMaintenanceWorkerRoute maps them into this.
 */
export type StopDisplayStatus = 'upcoming' | 'next' | 'arrived' | 'completed' | 'skipped';

export interface RouteStopView {
  id: string;
  /** 1-based position in the owner's saved order. */
  position: number;
  propertyName: string;
  address: string;
  /** Destination for directions (coordinates when the property has them). */
  place: Place;
  services: string[];
  /** This visit's instructions from the owner (not the permanent contract notes). */
  instructions?: string;
  /** Permanent access notes for the property (gate code, dog, etc). */
  accessNotes?: string;
  status: StopDisplayStatus;
  arrivedAt?: string;
  arrivedByName?: string;
  /** true = GPS verified, false = recorded without verified location, undefined = no arrival yet. */
  arrivalVerified?: boolean;
  completedAt?: string;
  completedByName?: string;
  checklistDone: number;
  checklistTotal: number;
  photosRequired: number;
  photosTaken: number;
}
