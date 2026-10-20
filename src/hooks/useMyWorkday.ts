import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { todayKey } from '@/lib/ids';
import { netMs, grossMs, type TimeBreak } from '@/lib/timeCalc';
import {
  onTimeChanged, clockIn as apiClockIn, clockOut as apiClockOut, completeVisit as apiCompleteVisit, endBreak as apiEndBreak, loadMyDay, loadTruckOptions,
  startBreak as apiStartBreak, startVisit as apiStartVisit,
  type Gps, type MyDay, type MyWorkday, type Result, type TruckOptions,
} from '@/data/timeTracking';

const POLL_MS = 60_000;

export interface Workday {
  /** null while the first answer is loading; false when the database update isn't installed (the old check-in screens are used). */
  installed: boolean | null;
  day: MyDay | null;
  loading: boolean;
  /** An action is running (clock in, start a property, ...). */
  busy: boolean;
  /** The last problem, in plain words. Cleared by the next action. */
  error: string | null;
  /** Server time in ms (the phone clock plus the server offset), ticking every second while this hook is in use. */
  now: number;
  active?: MyWorkday;
  /** The workday that counts for "today" (the open one, else the latest closed one today). */
  today?: MyWorkday;
  onBreak: boolean;
  /** Workday total for the day: net payable time across today's workdays (live while clocked in). */
  todayNetMs: number;
  todayGrossMs: number;
  refresh: () => Promise<void>;
  loadTrucks: () => Promise<Result<TruckOptions>>;
  clockIn: (truckId?: string) => Promise<Result<MyDay>>;
  clockOut: () => Promise<Result<MyDay>>;
  startBreak: () => Promise<Result<MyDay>>;
  endBreak: () => Promise<Result<MyDay>>;
  startVisit: (source: 'maintenance_stop' | 'assignment', refId: string, gps?: Gps) => Promise<Result<MyDay>>;
  completeVisit: (visitId: string, note?: string, gps?: Gps) => Promise<Result<MyDay>>;
}

/**
 * The signed-in worker's workday: clock in/out, breaks, and the property they are working at. Everything comes from the database;
 * a tap shows as done only after the database says so. While a property or workday is open the screen refreshes every minute
 * (which is also when the database looks for alerts).
 */
export function useMyWorkday(enabled: boolean): Workday {
  const [day, setDay] = useState<MyDay | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const offset = useRef(0);
  const inFlight = useRef(false);

  const apply = useCallback((r: Result<MyDay>) => {
    if (r.ok) {
      offset.current = r.data.clockOffsetMs;
      setDay(r.data);
      setInstalled(true);
      setError(null);
    } else if (r.notInstalled) {
      setInstalled(false);
    } else {
      setError(r.error);
    }
    return r;
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    const r = await loadMyDay(todayKey());
    inFlight.current = false;
    setLoading(false);
    if (r.ok) apply(r);
    else if (r.notInstalled) setInstalled(false);
    else setError(r.error);
  }, [enabled, apply]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearInterval(poll); sub.remove(); };
  }, [enabled, refresh]);

  // Something else (a maintenance stop screen, for example) started or finished a property: pick the new state up now.
  useEffect(() => (enabled ? onTimeChanged(() => { refresh(); }) : undefined), [enabled, refresh]);

  useEffect(() => {
    if (!enabled || installed !== true) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [enabled, installed]);

  const act = useCallback(async <T,>(run: () => Promise<Result<T>>): Promise<Result<T>> => {
    setBusy(true);
    setError(null);
    const r = await run();
    setBusy(false);
    if (!r.ok) {
      if (r.notInstalled) setInstalled(false);
      else setError(r.error);
    }
    return r;
  }, []);

  const doApply = useCallback((r: Result<MyDay>) => (r.ok ? apply(r) : r), [apply]);

  const now = Date.now() + offset.current;
  void tick;

  const active = day?.days.find((d) => !d.clockOutAt);
  const todays = useMemo(() => (day?.days ?? []).filter((d) => d.workDate === day?.workDate || !d.clockOutAt), [day]);
  const today = active ?? todays[todays.length - 1];
  const asBreaks = (b: MyWorkday['breaks']): TimeBreak[] => b.map((x) => ({ startedAt: x.startedAt, endedAt: x.endedAt ?? null, paid: x.paid }));
  const todayNet = todays.reduce((t, d) => t + netMs({ clockInAt: d.clockInAt, clockOutAt: d.clockOutAt ?? null }, asBreaks(d.breaks), now), 0);
  const todayGross = todays.reduce((t, d) => t + grossMs({ clockInAt: d.clockInAt, clockOutAt: d.clockOutAt ?? null }, now), 0);

  return {
    installed, day, loading, busy, error, now, active, today,
    onBreak: !!active?.breaks.some((b) => !b.endedAt),
    todayNetMs: todayNet, todayGrossMs: todayGross,
    refresh,
    loadTrucks: () => loadTruckOptions(todayKey()),
    clockIn: (truckId) => act(() => apiClockIn(todayKey(), truckId).then(doApply)),
    clockOut: () => act(() => apiClockOut().then(doApply)),
    startBreak: () => act(() => apiStartBreak().then(doApply)),
    endBreak: () => act(() => apiEndBreak().then(doApply)),
    startVisit: (source, refId, gps) => act(() => apiStartVisit(source, refId, gps).then(doApply)),
    completeVisit: (visitId, note, gps) => act(() => apiCompleteVisit(visitId, note, gps).then(doApply)),
  };
}
