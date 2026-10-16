/**
 * Storm lifecycle (supabase/updates/024): create a draft storm for one
 * service, dispatch it, end it, reopen it.
 *
 * Every status change goes through a database function that checks the
 * caller is the owner/admin and that the move is allowed
 * (draft → dispatched → ended → reopened as dispatched). Repeating a call
 * (double tap, retry after a dropped connection) changes nothing and returns
 * `changed: false`. The app can still rename a storm or edit its notes
 * directly. Nothing here pretends to save without the live database.
 *
 * Reopening only changes the storm: earlier visits stay completed or
 * skipped, and no customer notification or media share is repeated.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uuid } from '@/lib/ids';
import type { SnowService, SnowStorm } from '@/types/snow';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

const NOT_CONNECTED = 'Storms need the live database, which isn\'t connected in this version of the app.';

type Row = Record<string, unknown>;

function camel(key: string) {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
function fromDb<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[camel(k)] = v;
  return out as T;
}

function message(err: { message: string; code?: string } | null | undefined, fallback: string): string {
  if (!err) return fallback;
  if (err.code === '42501' || /permission denied|row-level security/.test(err.message)) {
    return 'Only the owner or an admin can change storms.';
  }
  return err.message || fallback;
}

/** Where the storm's work stands. Cancelled routes aren't counted. */
export interface StormSummary {
  routes: number;
  visits: number;
  completed: number;
  skipped: number;
  /** Lead tapped I'm Here but hasn't finished. */
  arrived: number;
  /** Not started. */
  pending: number;
  pendingSkipRequests: number;
}

export interface StormActionResult {
  storm: SnowStorm;
  /** False when the storm was already in that state (a repeated tap). */
  changed: boolean;
  summary: StormSummary;
}

function toResult(data: unknown): StormActionResult {
  const d = data as { storm: Row; changed: boolean; summary: Row };
  const s = d.summary ?? {};
  return {
    storm: fromDb<SnowStorm>(d.storm),
    changed: !!d.changed,
    summary: {
      routes: Number(s.routes ?? 0),
      visits: Number(s.visits ?? 0),
      completed: Number(s.completed ?? 0),
      skipped: Number(s.skipped ?? 0),
      arrived: Number(s.arrived ?? 0),
      pending: Number(s.pending ?? 0),
      pendingSkipRequests: Number(s.pending_skip_requests ?? 0),
    },
  };
}

async function call(fn: string, args: Row, fallback: string): Promise<Result<StormActionResult>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc(fn, args);
  if (error || !data) return fail(message(error, fallback));
  return ok(toResult(data));
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** Every storm the caller can see (owner/admin: all), newest first. */
export async function loadStorms(): Promise<Result<SnowStorm[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.from('snow_storms').select('*').order('created_at', { ascending: false });
  if (error) return fail(message(error, 'Couldn\'t load storms.'));
  return ok((data ?? []).map((r) => fromDb<SnowStorm>(r as Row)));
}

export interface EligibleProperty {
  propertyId: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  mapDestination?: string;
}

/** Active properties that offer this storm's service, for building its routes. */
export async function loadEligibleProperties(stormId: string): Promise<Result<EligibleProperty[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_storm_eligible_properties', { p_storm_id: stormId });
  if (error) return fail(message(error, 'Couldn\'t load properties.'));
  return ok(((data ?? []) as Row[]).map((r) => fromDb<EligibleProperty>(r)));
}

/** What ending the storm would leave behind, for the confirmation. Changes nothing. */
export function previewEndStorm(stormId: string) {
  return call('snow_storm_end_preview', { p_storm_id: stormId }, 'Couldn\'t check the storm.');
}

/** A storm's routes as the owner sees them on the storm screen. */
export interface StormRouteRow {
  id: string;
  name: string;
  position: number;
  leadPersonId?: string;
  leadName?: string;
  cancelled: boolean;
  stops: number;
  completed: number;
  skipped: number;
}

/** Routes with their lead and stop counts. Route editing lives with the routes screens (update 025). */
export async function loadStormRoutes(stormId: string): Promise<Result<StormRouteRow[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const [routes, visits] = await Promise.all([
    supabase.from('snow_routes').select('id, name, position, lead_person_id, cancelled_at').eq('storm_id', stormId)
      .order('position').order('created_at'),
    supabase.from('snow_visits').select('route_id, status').eq('storm_id', stormId),
  ]);
  if (routes.error) return fail(message(routes.error, 'Couldn\'t load routes.'));
  if (visits.error) return fail(message(visits.error, 'Couldn\'t load stops.'));
  const leadIds = [...new Set((routes.data ?? []).map((r) => r.lead_person_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (leadIds.length) {
    const { data } = await supabase.from('people').select('id, first_name, last_name').in('id', leadIds);
    for (const p of data ?? []) names.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed');
  }
  return ok((routes.data ?? []).map((r) => {
    const mine = (visits.data ?? []).filter((v) => v.route_id === r.id);
    return {
      id: r.id,
      name: r.name,
      position: r.position,
      leadPersonId: r.lead_person_id ?? undefined,
      leadName: r.lead_person_id ? names.get(r.lead_person_id) : undefined,
      cancelled: !!r.cancelled_at,
      stops: mine.length,
      completed: mine.filter((v) => v.status === 'completed').length,
      skipped: mine.filter((v) => v.status === 'skipped').length,
    };
  }));
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Creates a draft storm. Pass the same `requestId` when retrying the same
 * tap so only one storm is made (keep it for the life of the form).
 */
export function createStorm(input: { name: string; service: SnowService; notes?: string; requestId?: string }) {
  return call('snow_create_storm', {
    p_name: input.name.trim(),
    p_service: input.service,
    p_notes: input.notes?.trim() || null,
    p_client_request_id: input.requestId ?? uuid(),
  }, 'Couldn\'t create the storm.');
}

/** Draft → dispatched. Needs a route with stops, and a lead on every route with stops. */
export function dispatchStorm(stormId: string) {
  return call('snow_dispatch_storm', { p_storm_id: stormId }, 'Couldn\'t dispatch the storm.');
}

/** Dispatched → ended. Always ask first (see `endStormConfirmation`). */
export function endStorm(stormId: string) {
  return call('snow_end_storm', { p_storm_id: stormId }, 'Couldn\'t end the storm.');
}

/** Ended → dispatched again. Earlier work, media and notifications are left as they were. */
export function reopenStorm(stormId: string) {
  return call('snow_reopen_storm', { p_storm_id: stormId }, 'Couldn\'t reopen the storm.');
}

/** Name and notes are the only fields the app edits directly. */
export async function renameStorm(stormId: string, patch: { name?: string; notes?: string | null }): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const values: Row = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) return fail('Give the storm a name.');
    values.name = patch.name.trim();
  }
  if (patch.notes !== undefined) values.notes = patch.notes?.trim() || null;
  const { error } = await supabase.from('snow_storms').update(values).eq('id', stormId);
  if (error) return fail(message(error, 'Couldn\'t save the storm.'));
  return ok(undefined);
}

/** Only drafts can be deleted; a dispatched storm is ended instead. */
export async function deleteDraftStorm(stormId: string): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.from('snow_storms').delete().eq('id', stormId);
  if (error) return fail(message(error, 'Couldn\'t delete the draft.'));
  return ok(undefined);
}

// ── Wording for the End Storm confirmation ──────────────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const SERVICE_LABEL: Record<SnowService, string> = {
  plowing: 'Plowing',
  shoveling: 'Shoveling / Sidewalks',
  salting: 'Salting',
};

export const STORM_STATUS_LABEL: Record<SnowStorm['status'], string> = {
  draft: 'Draft',
  dispatched: 'Active',
  ended: 'Ended',
};

/** A starting name for a new storm, e.g. "Jan 12 Plowing". */
export function defaultStormName(service: SnowService, now = new Date()): string {
  const day = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} ${service === 'shoveling' ? 'Sidewalks' : SERVICE_LABEL[service]}`;
}

/** Plain-language implications of ending, from `previewEndStorm`. Layout is up to the screen. */
export function endStormConfirmation(storm: Pick<SnowStorm, 'name'>, s: StormSummary): { title: string; message: string } {
  const lines: string[] = [];
  const open = s.pending + s.arrived;
  if (open > 0) lines.push(`${plural(open, 'stop')} not finished. They'll stay unfinished, not completed.`);
  if (s.pendingSkipRequests > 0) lines.push(`${plural(s.pendingSkipRequests, 'skip request')} waiting for your decision. You can decide after reopening.`);
  lines.push('Leads can\'t record more work until you reopen the storm. Everything done so far is kept.');
  return { title: `End ${storm.name}?`, message: lines.join('\n\n') };
}
