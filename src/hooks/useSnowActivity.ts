import { useCallback, useEffect, useRef, useState } from 'react';
import { db, rpc, isDemo } from '@/data/store';

/**
 * The Owner's Snow Mode activity log (supabase/snow/029). Events are
 * written by the database whenever a snow record changes; this only reads
 * them, newest first, through snow_activity_feed (owner/admin only).
 */

export interface SnowActivityEvent {
  id: string;
  occurredAt: string;
  action: string;
  entity: string;
  recordTable?: string;
  recordId?: string;
  stormId?: string;
  routeId?: string;
  visitId?: string;
  propertyId?: string;
  workerPersonId?: string;
  service?: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: string[];
  note?: string;
  metadata: Record<string, unknown>;
  actorPersonId?: string;
  actorName?: string;
  workerName?: string;
}

export interface SnowActivityFilters {
  stormId?: string;
  routeId?: string;
  workerPersonId?: string;
  propertyId?: string;
  /** A whole action ('visit.completed') or every action on an entity ('visit'). */
  action?: string;
}

export type SnowFilterKind = 'storm' | 'route' | 'property' | 'worker' | 'action';

export interface SnowFilterOption {
  kind: SnowFilterKind;
  /** Record id for storm/route/property/worker; the action for 'action'. */
  value: string;
  /** Best name the log knows; empty when the record never had one logged. */
  label: string;
  count: number;
  lastAt: string;
}

interface EventRow {
  id: string;
  occurred_at: string;
  action: string;
  entity: string;
  record_table: string | null;
  record_id: string | null;
  storm_id: string | null;
  route_id: string | null;
  visit_id: string | null;
  property_id: string | null;
  worker_person_id: string | null;
  service: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed_fields: string[] | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  actor_person_id: string | null;
  actor_name: string | null;
  worker_name: string | null;
}

interface OptionRow {
  kind: SnowFilterKind;
  id: string | null;
  action: string | null;
  label: string | null;
  event_count: number;
  last_at: string;
}

const PAGE = 50;

function fromRow(r: EventRow): SnowActivityEvent {
  return {
    id: r.id,
    occurredAt: r.occurred_at,
    action: r.action,
    entity: r.entity,
    recordTable: r.record_table ?? undefined,
    recordId: r.record_id ?? undefined,
    stormId: r.storm_id ?? undefined,
    routeId: r.route_id ?? undefined,
    visitId: r.visit_id ?? undefined,
    propertyId: r.property_id ?? undefined,
    workerPersonId: r.worker_person_id ?? undefined,
    service: r.service ?? undefined,
    before: r.before,
    after: r.after,
    changedFields: r.changed_fields ?? [],
    note: r.note ?? undefined,
    metadata: r.metadata ?? {},
    actorPersonId: r.actor_person_id ?? undefined,
    actorName: r.actor_name ?? undefined,
    workerName: r.worker_name ?? undefined,
  };
}

function feedArgs(f: SnowActivityFilters, before?: SnowActivityEvent) {
  return {
    p_company_id: db.companyId,
    p_storm_id: f.stormId ?? null,
    p_route_id: f.routeId ?? null,
    p_worker_person_id: f.workerPersonId ?? null,
    p_property_id: f.propertyId ?? null,
    p_action: f.action ?? null,
    p_before_at: before?.occurredAt ?? null,
    p_before_id: before?.id ?? null,
    p_limit: PAGE,
  };
}

export function useSnowActivity(filters: SnowActivityFilters) {
  const [events, setEvents] = useState<SnowActivityEvent[]>([]);
  const [options, setOptions] = useState<SnowFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  // Ignore answers to an older filter choice that arrive late.
  const requestId = useRef(0);
  const key = JSON.stringify(filters);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    if (isDemo()) {
      // There is no snow data in demo mode; show the honest empty state.
      setEvents([]);
      setOptions([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [feed, opts] = await Promise.all([
      rpc<EventRow[]>('snow_activity_feed', feedArgs(filters)),
      rpc<OptionRow[]>('snow_activity_filter_options', { p_company_id: db.companyId }),
    ]);
    if (id !== requestId.current) return;
    if (feed.error) {
      setError(feed.error.message);
    } else {
      setError('');
      const rows = (feed.data ?? []).map(fromRow);
      setEvents(rows);
      setHasMore(rows.length === PAGE);
    }
    if (!opts.error) {
      setOptions((opts.data ?? []).map((o) => ({
        kind: o.kind,
        value: (o.kind === 'action' ? o.action : o.id) ?? '',
        label: o.label ?? '',
        count: Number(o.event_count) || 0,
        lastAt: o.last_at,
      })));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || events.length === 0 || isDemo()) return;
    const id = requestId.current;
    setLoadingMore(true);
    const { data, error: rpcError } = await rpc<EventRow[]>('snow_activity_feed', feedArgs(filters, events[events.length - 1]));
    if (id !== requestId.current) return;
    setLoadingMore(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const rows = (data ?? []).map(fromRow);
    setEvents((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]);
    setHasMore(rows.length === PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, events, hasMore, loadingMore]);

  useEffect(() => {
    load();
  }, [load]);

  return { events, options, loading, loadingMore, hasMore, error, reload: load, loadMore };
}
