/**
 * Snow route management for the owner/admin (supabase/updates/025):
 * add, reorder, move and remove stops, set or change a route's lead, and
 * route templates. Every change goes through a database function, which
 * checks the caller is owner/admin, locks the route while it renumbers stops
 * and writes the activity log. Leads can't call any of these.
 *
 * Snow records aren't in the in-memory store (see the snow architecture
 * review): screens load what they show with the read functions here.
 * There is no demo-mode version; without Supabase these return an error
 * rather than pretending to save.
 */
import { supabase } from '@/lib/supabase';
import { db, isDemo, rpc } from './store';
import type {
  SnowApplyTemplateResult, SnowLeadConflict, SnowRoute, SnowRouteTemplate, SnowRouteTemplateStop, SnowVisit,
} from '@/types/snow';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });
const NEEDS_LIVE = 'Snow routes need the live database.';

function camelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** snake_case row → camelCase app shape (one level; jsonb values kept as-is). */
function shape<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[camelKey(k)] = v;
  return out as T;
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  if (isDemo()) return fail(NEEDS_LIVE);
  const { data, error } = await rpc<T>(fn, args);
  return error ? fail(error.message) : ok(data as T);
}

/** A fresh id for retry-safe creates (same id on retry = no duplicate). */
export function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** A storm's routes (in order) and all their stops (in route order). */
export async function loadStormRoutes(stormId: string): Promise<Result<{ routes: SnowRoute[]; visits: SnowVisit[] }>> {
  if (isDemo()) return fail(NEEDS_LIVE);
  const [routes, visits] = await Promise.all([
    supabase.from('snow_routes').select('*').eq('storm_id', stormId).order('position').order('created_at'),
    supabase.from('snow_visits').select('*').eq('storm_id', stormId).order('route_id').order('position'),
  ]);
  if (routes.error) return fail(routes.error.message);
  if (visits.error) return fail(visits.error.message);
  return ok({
    routes: (routes.data ?? []).map((r) => shape<SnowRoute>(r)),
    visits: (visits.data ?? []).map((v) => shape<SnowVisit>(v)),
  });
}

export async function loadTemplates(): Promise<Result<{ templates: SnowRouteTemplate[]; stops: SnowRouteTemplateStop[] }>> {
  if (isDemo()) return fail(NEEDS_LIVE);
  const [templates, stops] = await Promise.all([
    supabase.from('snow_route_templates').select('*').order('name'),
    supabase.from('snow_route_template_stops').select('*').order('template_id').order('position'),
  ]);
  if (templates.error) return fail(templates.error.message);
  if (stops.error) return fail(stops.error.message);
  return ok({
    templates: (templates.data ?? []).map((t) => shape<SnowRouteTemplate>(t)),
    stops: (stops.data ?? []).map((s) => shape<SnowRouteTemplateStop>(s)),
  });
}

/** Other open routes this person already leads (to warn before assigning). */
export async function leadConflicts(personId: string, exceptRouteId?: string): Promise<Result<SnowLeadConflict[]>> {
  const res = await call<Record<string, unknown>[]>('snow_lead_conflicts', { p_person_id: personId, p_except_route_id: exceptRouteId ?? null });
  return res.ok ? ok((res.data ?? []).map((c) => shape<SnowLeadConflict>(c))) : res;
}

// ── Stops ───────────────────────────────────────────────────────────────────

/**
 * Add a stop. position 1 = first; omit for last. Works before and after
 * dispatch (also ahead of the lead's next stop), and the property can
 * already be on the route: each pass is its own visit. Pass the same
 * requestId when retrying so a dropped connection never adds it twice.
 */
export function addVisit(routeId: string, propertyId: string, opts: { position?: number; requestId?: string } = {}) {
  return call<string>('snow_add_visit', {
    p_route_id: routeId, p_property_id: propertyId,
    p_position: opts.position ?? null, p_client_request_id: opts.requestId ?? newRequestId(),
  });
}

/** Save a new stop order: every stop id on the route, first to last. */
export function reorderRoute(routeId: string, visitIds: string[]) {
  return call<null>('snow_reorder_route', { p_route_id: routeId, p_visit_ids: visitIds });
}

/** Move a stop that hasn't been started to another route of the same storm. */
export function moveVisit(visitId: string, toRouteId: string, position?: number) {
  return call<null>('snow_move_visit', { p_visit_id: visitId, p_to_route_id: toRouteId, p_position: position ?? null });
}

/** Take off a stop that hasn't been started. */
export function removeVisit(visitId: string) {
  return call<null>('snow_remove_visit', { p_visit_id: visitId });
}

// ── Lead ────────────────────────────────────────────────────────────────────

export type AssignLeadResult =
  | { assigned: true; conflicts: SnowLeadConflict[] }
  /** Nothing changed: the person leads these other routes. Ask, then call again with confirm. */
  | { assigned: false; conflicts: SnowLeadConflict[] };

/**
 * Set (or clear, with null) a route's lead. If the person already leads
 * other open routes and `confirm` is false, nothing changes and the
 * conflicts come back so the screen can ask "Assign anyway?". There is no
 * limit on how many routes one person leads.
 */
export async function assignLead(routeId: string, personId: string | null, confirm = false): Promise<Result<AssignLeadResult>> {
  const res = await call<{ assigned: boolean; conflicts: Record<string, unknown>[] }>('snow_assign_lead', {
    p_route_id: routeId, p_person_id: personId, p_confirm: confirm,
  });
  if (!res.ok) return res;
  return ok({ assigned: !!res.data?.assigned, conflicts: (res.data?.conflicts ?? []).map((c) => shape<SnowLeadConflict>(c)) } as AssignLeadResult);
}

// ── Templates ───────────────────────────────────────────────────────────────

export type TemplateInput = Pick<SnowRouteTemplate, 'name' | 'service'>
  & Partial<Pick<SnowRouteTemplate, 'leadPersonId' | 'mediaRequired' | 'minMedia' | 'notes'>>;

export async function createTemplate(input: TemplateInput, propertyIds: string[] = []): Promise<Result<string>> {
  if (isDemo()) return fail(NEEDS_LIVE);
  const companyId = db.companyId;
  if (!companyId || (db.role !== 'owner' && db.role !== 'admin')) return fail('Only the owner or an admin can make templates.');
  const { data, error } = await supabase.from('snow_route_templates').insert({
    company_id: companyId, name: input.name.trim(), service: input.service,
    lead_person_id: input.leadPersonId ?? null, media_required: input.mediaRequired ?? false,
    min_media: input.minMedia ?? 1, notes: input.notes ?? null,
  }).select('id').single();
  if (error) return fail(error.message);
  if (propertyIds.length) {
    const stops = await setTemplateStops(data.id, propertyIds);
    if (!stops.ok) return stops;
  }
  return ok(data.id as string);
}

/** Rename, change the suggested lead or photo rule, or archive (archivedAt). */
export async function updateTemplate(id: string, patch: Partial<TemplateInput> & { archivedAt?: string | null }): Promise<Result> {
  if (isDemo()) return fail(NEEDS_LIVE);
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.service !== undefined) row.service = patch.service;
  if (patch.leadPersonId !== undefined) row.lead_person_id = patch.leadPersonId ?? null;
  if (patch.mediaRequired !== undefined) row.media_required = patch.mediaRequired;
  if (patch.minMedia !== undefined) row.min_media = patch.minMedia;
  if (patch.notes !== undefined) row.notes = patch.notes ?? null;
  if (patch.archivedAt !== undefined) row.archived_at = patch.archivedAt;
  const { error } = await supabase.from('snow_route_templates').update(row).eq('id', id);
  return error ? fail(error.message) : ok(undefined);
}

/** Routes made from it keep their stops and a snapshot. */
export async function deleteTemplate(id: string): Promise<Result> {
  if (isDemo()) return fail(NEEDS_LIVE);
  const { error } = await supabase.from('snow_route_templates').delete().eq('id', id);
  return error ? fail(error.message) : ok(undefined);
}

/** Replace the template's stops with this order (a property may repeat). */
export function setTemplateStops(templateId: string, propertyIds: string[]) {
  return call<null>('snow_set_template_stops', { p_template_id: templateId, p_property_ids: propertyIds });
}

export function saveRouteAsTemplate(routeId: string, name: string) {
  return call<string>('snow_save_route_as_template', { p_route_id: routeId, p_name: name });
}

/**
 * Make a new route in a storm from a template. Stops for inactive properties
 * or properties that no longer get the service are left out and listed in
 * `skipped`. Pass the same requestId on retry.
 */
export async function applyTemplate(
  templateId: string, stormId: string, opts: { routeName?: string; requestId?: string } = {},
): Promise<Result<SnowApplyTemplateResult>> {
  const res = await call<Record<string, unknown>>('snow_apply_template', {
    p_template_id: templateId, p_storm_id: stormId,
    p_route_name: opts.routeName ?? null, p_client_request_id: opts.requestId ?? newRequestId(),
  });
  if (!res.ok) return res;
  const d = res.data ?? {};
  return ok({
    routeId: d.route_id as string,
    added: Number(d.added ?? 0),
    skipped: ((d.skipped as Record<string, unknown>[]) ?? []).map((s) => shape(s)),
    leadDropped: !!d.lead_dropped,
  });
}
