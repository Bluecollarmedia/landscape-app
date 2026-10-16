/**
 * Snow property details (supabase/updates/022): contacts, the services a
 * property gets, and each service's versioned instructions and reference
 * photos/videos. The property itself (name, address) is the snow foundation's
 * snow_properties row.
 */

import type { SnowService } from './snow';

export { SNOW_SERVICES, type SnowService } from './snow';

export const SNOW_SERVICE_LABELS: Record<SnowService, string> = {
  plowing: 'Plowing',
  shoveling: 'Shoveling / Sidewalks',
  salting: 'Salting',
};

export const SNOW_SERVICE_ICONS: Record<SnowService, 'truck' | 'user' | 'droplet'> = {
  plowing: 'truck',
  shoveling: 'user',
  salting: 'droplet',
};

export interface SnowPropertyContact {
  id: string;
  companyId: string;
  propertyId: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  /** Linked customer account; lets that customer see this property. */
  personId?: string;
  isPrimary: boolean;
  sortOrder: number;
  removedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnowPropertyService {
  id: string;
  companyId: string;
  propertyId: string;
  service: SnowService;
  isActive: boolean;
  deactivatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** One saved version. Editing adds a version; old ones never change. */
export interface SnowServiceInstructions {
  id: string;
  companyId: string;
  propertyServiceId: string;
  version: number;
  body: string;
  createdBy?: string;
  createdAt: string;
}

/** Reference photo/video. Never deleted: removing sets retiredAt. */
export interface SnowReferenceMedia {
  id: string;
  companyId: string;
  propertyServiceId: string;
  mediaType: 'image' | 'video';
  fileKey: string;
  sizeBytes?: number;
  caption?: string;
  createdBy?: string;
  createdAt: string;
  retiredAt?: string;
  retiredBy?: string;
}

/** A service with what's in effect for it (now, or at a past moment). */
export interface SnowServiceReference {
  service: SnowPropertyService;
  instructions?: SnowServiceInstructions;
  media: SnowReferenceMedia[];
}
