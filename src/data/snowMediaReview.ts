/**
 * Snow completion media: Owner review, explicit sharing, and the customer's
 * snow history (supabase/updates/030).
 *
 * Every rule that matters lives in the database: new uploads always start
 * unreviewed and unshared, only the owner/admin can review or share, only an
 * approved item on a completed visit can be shared, removing never deletes
 * the upload, and customers can only reach completed visits and shared items
 * through snow_customer_history(). These functions just call it.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { discardSnowUpload, signedSnowMediaUrls, uploadSnowMedia } from '@/lib/snowMedia';
import type { SnowMediaKind } from '@/types/snow';
import type {
  SnowCustomerUpdate, SnowMediaReviewStatus, SnowMediaShare, SnowReviewMedia, SnowShareResult,
} from '@/types/snowMediaReview';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

const NOT_CONNECTED = 'Snow photos and videos need the live database, which isn\'t connected in this version of the app.';

type Row = Record<string, unknown>;

function camel(key: string) {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
function fromDb<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[camel(k)] = v;
  return out as T;
}

/** Where completion uploads go in the private bucket (the storage rules check this path). */
export function snowCompletionFolder(companyId: string, visitId: string): string {
  return `${companyId}/completion/${visitId}`;
}

// ── Owner: reading ──────────────────────────────────────────────────────────

/** Every photo/video uploaded at a visit, oldest first, removed ones included. */
export async function loadVisitMedia(visitId: string): Promise<Result<SnowReviewMedia[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.from('snow_completion_media')
    .select('*').eq('visit_id', visitId).order('created_at');
  if (error) return fail(error.message);
  return ok((data ?? []).map((r) => fromDb<SnowReviewMedia>(r)));
}

/** Items on completed visits that haven't been reviewed yet, oldest first. */
export async function loadUnreviewedMedia(companyId: string, stormId?: string): Promise<Result<SnowReviewMedia[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  let q = supabase.from('snow_completion_media')
    .select('*, snow_visits!inner(status)')
    .eq('company_id', companyId)
    .eq('review_status', 'unreviewed')
    .eq('snow_visits.status', 'completed')
    .order('created_at');
  if (stormId) q = q.eq('storm_id', stormId);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok((data ?? []).map(({ snow_visits: _visit, ...r }) => fromDb<SnowReviewMedia>(r)));
}

/** Every time an item was shared (and whether sharing stopped), newest first. */
export async function loadShareHistory(mediaId: string): Promise<Result<SnowMediaShare[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.from('snow_media_shares')
    .select('*').eq('media_id', mediaId).order('shared_at', { ascending: false });
  if (error) return fail(error.message);
  return ok((data ?? []).map((r) => fromDb<SnowMediaShare>(r)));
}

/** Signed links for showing items. Files the caller may not open are left out. */
export async function mediaLinks(items: { fileKey: string }[]): Promise<Record<string, string>> {
  return signedSnowMediaUrls(items.map((m) => m.fileKey));
}

// ── Owner: review and share ─────────────────────────────────────────────────

/**
 * Approve (pick for the customer), remove (leave out) or reset items. Items
 * already in that state are left alone. Removing or resetting a shared item
 * stops sharing it. Returns how many changed.
 */
export async function reviewMedia(mediaIds: string[], decision: SnowMediaReviewStatus, note?: string): Promise<Result<number>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_review_media', {
    p_media_ids: mediaIds, p_decision: decision, p_note: note?.trim() || null,
  });
  return error ? fail(error.message) : ok(Number(data ?? 0));
}

/**
 * Shares approved items from completed visits with the property's customer
 * contacts. Check `viewers`: 0 for a property means no customer account is
 * linked to it yet, so say so instead of "shared with the customer".
 */
export async function shareMedia(mediaIds: string[], note?: string): Promise<Result<SnowShareResult>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_share_media', {
    p_media_ids: mediaIds, p_note: note?.trim() || null,
  });
  if (error) return fail(error.message);
  const res = (data ?? {}) as { shared?: number; viewers?: Record<string, number> };
  return ok({ shared: Number(res.shared ?? 0), viewers: res.viewers ?? {} });
}

/** Stops sharing items (they stay approved; the share stays in history). */
export async function unshareMedia(mediaIds: string[], reason?: string): Promise<Result<number>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_unshare_media', {
    p_media_ids: mediaIds, p_reason: reason?.trim() || null,
  });
  return error ? fail(error.message) : ok(Number(data ?? 0));
}

export interface SnowCompletionDraft {
  uri: string;
  kind: SnowMediaKind;
  mimeType?: string;
  sizeBytes?: number;
  durationS?: number;
}

/**
 * Owner adds photos/videos to a visit. They start unreviewed like any other
 * upload. A file only counts once both the upload and the row succeed; a
 * half-finished upload is cleaned up.
 */
export async function addVisitMedia(companyId: string, visitId: string, drafts: SnowCompletionDraft[]): Promise<{ saved: SnowReviewMedia[]; errors: string[] }> {
  const saved: SnowReviewMedia[] = [];
  const errors: string[] = [];
  if (!isSupabaseConfigured) return { saved, errors: [NOT_CONNECTED] };
  for (const d of drafts) {
    let key: string | undefined;
    try {
      key = await uploadSnowMedia(d.uri, snowCompletionFolder(companyId, visitId), d.mimeType);
      const { data, error } = await supabase.from('snow_completion_media')
        .insert({ visit_id: visitId, kind: d.kind, file_key: key, size_bytes: d.sizeBytes ?? null, duration_s: d.durationS ?? null })
        .select().single();
      if (error) throw new Error(error.message);
      saved.push(fromDb<SnowReviewMedia>(data));
    } catch (err) {
      if (key) await discardSnowUpload(key);
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { saved, errors };
}

// ── Customer ────────────────────────────────────────────────────────────────

/**
 * The signed-in customer's completed snow services, newest first, with the
 * photos/videos shared from each (signed links included). Pass `before` (the
 * last item's completedAt) to load older ones.
 */
export async function loadCustomerSnowHistory(opts: { propertyId?: string; before?: string; limit?: number } = {}): Promise<Result<SnowCustomerUpdate[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_customer_history', {
    p_property_id: opts.propertyId ?? null, p_before: opts.before ?? null, p_limit: opts.limit ?? 50,
  });
  if (error) return fail(error.message);
  const updates = ((data ?? []) as Row[]).map((r) => fromDb<SnowCustomerUpdate>(r));
  const links = await signedSnowMediaUrls(updates.flatMap((u) => (u.media ?? []).map((m) => m.fileKey)))
    .catch(() => ({} as Record<string, string>));
  return ok(updates.map((u) => ({
    ...u,
    media: (u.media ?? []).map((m) => ({ ...m, url: links[m.fileKey] })),
  })));
}
