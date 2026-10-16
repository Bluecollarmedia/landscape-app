/**
 * Snow routes and stops (supabase/updates/025, 026).
 *
 * Owner/admin build routes for a storm: add a route, pick its lead, add
 * stops, reorder them (one database call so positions never clash), save a
 * route as a template and add a template to another storm. Route leads work
 * their stops in order: I'm Here, completion photos/videos, Finish Stop. The
 * database checks every step (dispatched storm, order, photo minimum).
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { discardSnowUpload, uploadSnowMedia } from '@/lib/snowMedia';
import type { SnowService } from '@/types/snow';
import type { SnowMediaDraft } from '@/data/snowProperties';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });
const NOT_CONNECTED = 'Routes need the live database, which isn\'t connected in this version of the app.';

function message(error: { message?: string } | null | undefined, fallback: string) {
  const m = error?.message?.trim();
  return m && !/^(permission denied|new row violates|JWT)/i.test(m) ? m : fallback;
}

export type VisitStatus = 'pending' | 'arrived' | 'completed' | 'skipped';

export interface RouteStop {
  id: string;
  propertyId: string;
  position: number;
  status: VisitStatus;
  propertyName: string;
  propertyAddress: string;
  arrivedAt?: string;
  completedAt?: string;
  completionNote?: string;
  mediaCount: number;
}

export interface RouteDetail {
  id: string;
  companyId: string;
  stormId: string;
  stormName: string;
  stormStatus: 'draft' | 'dispatched' | 'ended';
  service: SnowService;
  name: string;
  leadPersonId?: string;
  mediaRequired: boolean;
  minMedia: number;
  notes?: string;
  cancelled: boolean;
  stops: RouteStop[];
}

export interface SnowLead { personId: string; name: string }
export interface RouteTemplate { id: string; name: string; stops: number }

// ── Reading ─────────────────────────────────────────────────────────────────

/** One route with its storm and stops in order. Works for owner/admin and the route's lead. */
export async function loadRoute(routeId: string): Promise<Result<RouteDetail>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data: r, error } = await supabase
    .from('snow_routes')
    .select('id, company_id, storm_id, service, name, lead_person_id, media_required, min_media, notes, cancelled_at, snow_storms(name, status)')
    .eq('id', routeId)
    .maybeSingle();
  if (error) return fail(message(error, 'Couldn\'t load the route.'));
  if (!r) return fail('This route isn\'t available.');
  const [visits, media] = await Promise.all([
    supabase.from('snow_visits')
      .select('id, property_id, position, status, property_name, property_address, arrived_at, completed_at, completion_note')
      .eq('route_id', routeId).order('position'),
    supabase.from('snow_completion_media').select('visit_id').eq('route_id', routeId),
  ]);
  if (visits.error) return fail(message(visits.error, 'Couldn\'t load the stops.'));
  const counts = new Map<string, number>();
  for (const m of media.data ?? []) counts.set(m.visit_id, (counts.get(m.visit_id) ?? 0) + 1);
  const storm = (Array.isArray(r.snow_storms) ? r.snow_storms[0] : r.snow_storms) as { name: string; status: RouteDetail['stormStatus'] } | null;
  return ok({
    id: r.id,
    companyId: r.company_id,
    stormId: r.storm_id,
    stormName: storm?.name ?? 'Storm',
    stormStatus: storm?.status ?? 'draft',
    service: r.service,
    name: r.name,
    leadPersonId: r.lead_person_id ?? undefined,
    mediaRequired: !!r.media_required,
    minMedia: r.min_media ?? 1,
    notes: r.notes ?? undefined,
    cancelled: !!r.cancelled_at,
    stops: (visits.data ?? []).map((v) => ({
      id: v.id,
      propertyId: v.property_id,
      position: v.position,
      status: v.status,
      propertyName: v.property_name ?? 'Property',
      propertyAddress: v.property_address ?? '',
      arrivedAt: v.arrived_at ?? undefined,
      completedAt: v.completed_at ?? undefined,
      completionNote: v.completion_note ?? undefined,
      mediaCount: counts.get(v.id) ?? 0,
    })),
  });
}

/** Snow team members (plus owners/admins) who can lead a route for this service. */
export async function loadSnowLeads(service: SnowService): Promise<Result<SnowLead[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_staff_services')
    .select('person_id, snow_staff!inner(status)')
    .eq('service', service)
    .eq('snow_staff.status', 'active');
  if (error) return fail(message(error, 'Couldn\'t load the snow team.'));
  // Owners and admins can always lead.
  const { data: staff } = await supabase.from('company_members').select('person_id')
    .in('role', ['owner', 'admin']).eq('status', 'active');
  const ids = [...new Set([...(data ?? []), ...(staff ?? [])].map((d) => d.person_id as string))];
  if (!ids.length) return ok([]);
  const { data: people, error: pe } = await supabase.from('people').select('id, first_name, last_name').in('id', ids);
  if (pe) return fail(message(pe, 'Couldn\'t load the snow team.'));
  return ok((people ?? [])
    .map((p) => ({ personId: p.id, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed' }))
    .sort((a, b) => a.name.localeCompare(b.name)));
}

export async function loadRouteTemplates(service: SnowService): Promise<Result<RouteTemplate[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_route_templates')
    .select('id, name, snow_route_template_stops(count)')
    .eq('service', service)
    .order('name');
  if (error) return fail(message(error, 'Couldn\'t load templates.'));
  return ok((data ?? []).map((t) => {
    const c = t.snow_route_template_stops as unknown as { count: number }[] | undefined;
    return { id: t.id, name: t.name, stops: c?.[0]?.count ?? 0 };
  }));
}

/**
 * Routes the signed-in lead works, newest storm first. The database only
 * shows a lead their own live routes on dispatched or ended storms.
 */
export interface MyRoute { id: string; name: string; stormName: string; stormStatus: RouteDetail['stormStatus']; service: SnowService }
export async function loadMyRoutes(): Promise<Result<MyRoute[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_routes')
    .select('id, name, service, created_at, snow_storms!inner(name, status)')
    .is('cancelled_at', null)
    .neq('snow_storms.status', 'draft')
    .order('created_at', { ascending: false });
  if (error) return fail(message(error, 'Couldn\'t load your routes.'));
  return ok((data ?? []).map((r) => {
    const s = (Array.isArray(r.snow_storms) ? r.snow_storms[0] : r.snow_storms) as { name: string; status: RouteDetail['stormStatus'] };
    return { id: r.id, name: r.name, service: r.service, stormName: s.name, stormStatus: s.status };
  }));
}

// ── Owner: building routes ──────────────────────────────────────────────────

export async function createRoute(stormId: string, input: { name: string; leadPersonId?: string; mediaRequired: boolean; minMedia: number }): Promise<Result<string>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data: last } = await supabase.from('snow_routes').select('position').eq('storm_id', stormId)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from('snow_routes').insert({
    storm_id: stormId,
    name: input.name.trim(),
    lead_person_id: input.leadPersonId ?? null,
    media_required: input.mediaRequired,
    min_media: input.minMedia,
    position: (last?.position ?? 0) + 1,
  }).select('id').single();
  if (error || !data) return fail(message(error, 'Couldn\'t add the route.'));
  return ok(data.id as string);
}

export async function updateRoute(routeId: string, patch: { name?: string; leadPersonId?: string | null; mediaRequired?: boolean; minMedia?: number }): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.leadPersonId !== undefined) row.lead_person_id = patch.leadPersonId;
  if (patch.mediaRequired !== undefined) row.media_required = patch.mediaRequired;
  if (patch.minMedia !== undefined) row.min_media = patch.minMedia;
  const { error } = await supabase.from('snow_routes').update(row).eq('id', routeId);
  return error ? fail(message(error, 'Couldn\'t save the route.')) : ok(undefined);
}

export async function cancelRoute(routeId: string): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.from('snow_routes').update({ cancelled_at: new Date().toISOString() }).eq('id', routeId);
  return error ? fail(message(error, 'Couldn\'t cancel the route.')) : ok(undefined);
}

export async function addStops(routeId: string, propertyIds: string[]): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  // One at a time, in the order picked: the database numbers each new stop last.
  for (const propertyId of propertyIds) {
    const { error } = await supabase.from('snow_visits').insert({ route_id: routeId, property_id: propertyId });
    if (error) return fail(message(error, 'Couldn\'t add the stop.'));
  }
  return ok(undefined);
}

/** Removes a stop nobody has started. Worked stops are kept by the database. */
export async function removeStop(visitId: string): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.from('snow_visits').delete().eq('id', visitId).eq('status', 'pending');
  return error ? fail(message(error, 'Couldn\'t remove the stop.')) : ok(undefined);
}

export async function reorderStops(routeId: string, visitIds: string[]): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.rpc('snow_reorder_route', { p_route_id: routeId, p_visit_ids: visitIds });
  return error ? fail(message(error, 'Couldn\'t reorder the stops.')) : ok(undefined);
}

export async function saveRouteAsTemplate(routeId: string, name: string): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.rpc('snow_save_route_template', { p_route_id: routeId, p_name: name });
  return error ? fail(message(error, 'Couldn\'t save the template.')) : ok(undefined);
}

export async function addRouteFromTemplate(stormId: string, templateId: string): Promise<Result<string>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_apply_route_template', { p_storm_id: stormId, p_template_id: templateId });
  if (error || !data) return fail(message(error, 'Couldn\'t add the route.'));
  return ok(data as string);
}

// ── Lead: working the route ─────────────────────────────────────────────────

export async function arriveAtStop(visitId: string): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.rpc('snow_arrive_visit', { p_visit_id: visitId });
  return error ? fail(message(error, 'Couldn\'t record your arrival.')) : ok(undefined);
}

export async function finishStop(visitId: string, note?: string): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.rpc('snow_complete_visit', { p_visit_id: visitId, p_note: note ?? null });
  return error ? fail(message(error, 'Couldn\'t finish the stop.')) : ok(undefined);
}

/** Uploads completion photos/videos for a stop. A file only counts once its database row is saved. */
export async function addCompletionMedia(companyId: string, visitId: string, drafts: SnowMediaDraft[]): Promise<Result<number>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  let saved = 0;
  for (const d of drafts) {
    let key: string | null = null;
    try {
      key = await uploadSnowMedia(d.uri, `${companyId}/completion/${visitId}`, d.mimeType);
      const { error } = await supabase.rpc('snow_add_completion_media', {
        p_visit_id: visitId,
        p_kind: d.mediaType === 'video' ? 'video' : 'photo',
        p_file_key: key,
        p_size_bytes: d.sizeBytes ?? null,
      });
      if (error) throw new Error(message(error, 'Couldn\'t save the photo.'));
      saved += 1;
    } catch (e) {
      if (key) await discardSnowUpload(key);
      return saved ? ok(saved) : fail(e instanceof Error ? e.message : 'Upload failed.');
    }
  }
  return ok(saved);
}

export const STOP_STATUS_LABEL: Record<VisitStatus, string> = {
  pending: 'Not started',
  arrived: 'On site',
  completed: 'Done',
  skipped: 'Skipped',
};
