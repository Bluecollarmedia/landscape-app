/**
 * Snow Mode notifications (supabase/updates/031): customer arrival/completion
 * preferences per property, the owner's per-stop completion alert toggle, and
 * the record of every notification with what each channel actually did.
 *
 * Notifications are created by the database when a visit arrives or
 * completes, never by the app, and the send-snow-notification Edge Function
 * reports each channel's result. Nothing here marks anything as sent.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  SnowDeliveryStatus, SnowNotification, SnowNotificationDelivery, SnowNotifyPrefs,
} from '@/types/snowNotifications';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

const NOT_CONNECTED = 'Snow notifications need the live database, which isn\'t connected in this version of the app.';

type Row = Record<string, unknown>;
function fromDb<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null) out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out as T;
}

// ── Customer preferences ────────────────────────────────────────────────────

/** Preferences for one property (owner/admin, or a linked customer contact). */
export async function loadNotifyPrefs(propertyId: string): Promise<Result<SnowNotifyPrefs | null>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_property_notify_prefs').select('*').eq('property_id', propertyId).maybeSingle();
  if (error) return fail(error.message);
  return ok(data ? fromDb<SnowNotifyPrefs>(data) : null);
}

/** Every property's preferences this person may see, keyed by property id. */
export async function loadAllNotifyPrefs(): Promise<Result<Record<string, SnowNotifyPrefs>>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.from('snow_property_notify_prefs').select('*');
  if (error) return fail(error.message);
  const out: Record<string, SnowNotifyPrefs> = {};
  for (const row of data ?? []) {
    const p = fromDb<SnowNotifyPrefs>(row);
    out[p.propertyId] = p;
  }
  return ok(out);
}

/** Change one or both preferences. Leave a field out to keep it. Logged. */
export async function setNotifyPrefs(
  propertyId: string,
  change: { notifyOnArrival?: boolean; notifyOnCompletion?: boolean },
): Promise<Result<SnowNotifyPrefs>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_set_notify_prefs', {
    p_property_id: propertyId,
    p_on_arrival: change.notifyOnArrival ?? null,
    p_on_completion: change.notifyOnCompletion ?? null,
  });
  if (error) return fail(error.message);
  return ok(fromDb<SnowNotifyPrefs>(data as Row));
}

// ── Owner per-stop completion alerts ────────────────────────────────────────

export async function loadOwnerStopAlerts(companyId: string): Promise<Result<boolean>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_settings').select('owner_stop_alerts').eq('company_id', companyId).maybeSingle();
  if (error) return fail(error.message);
  return ok(data?.owner_stop_alerts ?? true);
}

/** Only changes owner alerts; customer notices and completion are unaffected. */
export async function setOwnerStopAlerts(companyId: string, enabled: boolean): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_settings').update({ owner_stop_alerts: enabled }).eq('company_id', companyId).select('company_id');
  if (error) return fail(error.message);
  if (!data?.length) return fail('Only the owner or an admin can change this.');
  return ok(undefined);
}

// ── Notification records (owner/admin) ──────────────────────────────────────

export async function loadSnowNotifications(filter: {
  stormId?: string; visitId?: string; propertyId?: string; limit?: number;
} = {}): Promise<Result<SnowNotification[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  let q = supabase
    .from('snow_notifications')
    .select('*, deliveries:snow_notification_deliveries(*)')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.stormId) q = q.eq('storm_id', filter.stormId);
  if (filter.visitId) q = q.eq('visit_id', filter.visitId);
  if (filter.propertyId) q = q.eq('property_id', filter.propertyId);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok((data ?? []).map((row: Row) => {
    const n = fromDb<SnowNotification>(row);
    n.deliveries = ((row.deliveries as Row[]) ?? []).map((d) => fromDb<SnowNotificationDelivery>(d));
    return n;
  }));
}

/** After this long without an answer, a pending channel most likely never went out. */
const SENDER_SILENT_MS = 15 * 60 * 1000;

/**
 * Plain words for one channel's state. Never says "delivered" for anything
 * the provider merely accepted.
 */
export function describeDelivery(d: SnowNotificationDelivery, now = Date.now()): { label: string; tone: 'ok' | 'waiting' | 'problem' } {
  const channel = d.channel === 'in_app' ? 'In app' : d.channel === 'push' ? 'Push' : 'Email';
  const s: SnowDeliveryStatus = d.status;
  if (s === 'stored') return { label: `${channel}: saved in their notifications`, tone: 'ok' };
  if (s === 'delivered') return { label: `${channel}: delivered`, tone: 'ok' };
  if (s === 'accepted') return { label: `${channel}: sent (not yet confirmed received)`, tone: 'ok' };
  if (s === 'failed') return { label: `${channel}: failed${d.detail ? ` (${d.detail})` : ''}`, tone: 'problem' };
  if (s === 'unavailable') return { label: `${channel}: not sent${d.detail ? ` (${d.detail})` : ''}`, tone: 'problem' };
  if (now - new Date(d.createdAt).getTime() > SENDER_SILENT_MS) {
    return { label: `${channel}: no answer from the sender, probably not sent`, tone: 'problem' };
  }
  return { label: `${channel}: sending…`, tone: 'waiting' };
}

// ── A customer's own properties ─────────────────────────────────────────────

/** The properties this signed-in customer is a linked contact for. */
export async function loadMySnowProperties(): Promise<Result<{ id: string; name: string; address: string }[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_my_properties');
  if (error) return fail(error.message);
  return ok(((data ?? []) as Row[]).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    address: [p.address, p.city].filter(Boolean).join(', '),
  })));
}
