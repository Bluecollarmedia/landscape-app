/**
 * Owner review and customer sharing of snow completion media
 * (supabase/updates/030_snow_media_review.sql).
 */

import type { SnowCompletionMedia, SnowMediaKind, SnowService } from './snow';

/** Per item: not looked at yet, picked for the customer, or left out. */
export type SnowMediaReviewStatus = 'unreviewed' | 'approved' | 'removed';

/** A completion photo/video with its review and share state (owner/admin only). */
export interface SnowReviewMedia extends SnowCompletionMedia {
  reviewStatus: SnowMediaReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  /** Set while the item is shared with the property's customer contacts. */
  sharedBy?: string;
  sharedAt?: string;
}

/** One time an item was shared; revokedAt is set if sharing stopped later. */
export interface SnowMediaShare {
  id: string;
  companyId: string;
  mediaId: string;
  visitId: string;
  propertyId: string;
  sharedBy?: string;
  sharedAt: string;
  note?: string;
  revokedBy?: string;
  revokedAt?: string;
  revokeReason?: string;
}

export interface SnowShareResult {
  /** Items newly shared by this call (already-shared items aren't counted). */
  shared: number;
  /**
   * Linked customer accounts per property that can now see them. 0 means no
   * customer account is linked to that property yet, so nobody sees it.
   */
  viewers: Record<string, number>;
}

/** What a customer sees: a completed service and the items shared from it. */
export interface SnowCustomerUpdate {
  visitId: string;
  propertyId: string;
  propertyName: string;
  service: SnowService;
  /** "Plowing completed", "Sidewalk service completed", "Salting completed". */
  title: string;
  completedAt: string;
  media: SnowCustomerMedia[];
}

export interface SnowCustomerMedia {
  id: string;
  kind: SnowMediaKind;
  fileKey: string;
  capturedAt: string;
  /** Short-lived signed link; missing if the file couldn't be signed. */
  url?: string;
}
