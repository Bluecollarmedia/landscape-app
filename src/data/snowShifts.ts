/**
 * Snow clock in / clock out (supabase/updates/028). Separate from
 * landscaping Payroll. Original times never change; the owner adds
 * corrections and the latest correction is what counts.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uuid } from '@/lib/ids';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });
const NOT_CONNECTED = 'The snow time clock needs the live database, which isn\'t connected in this version of the app.';

function message(error: { message?: string } | null | undefined, fallback: string) {
  const m = error?.message?.trim();
  return m && !/^(permission denied|new row violates|JWT)/i.test(m) ? m : fallback;
}

export interface SnowShift {
  id: string;
  personId: string;
  personName?: string;
  /** Times that count: the latest correction's, else the original. */
  clockInAt: string;
  clockOutAt?: string;
  /** The times as tapped. */
  originalIn: string;
  originalOut?: string;
  /** The storm this shift was tagged with at clock-in (update 42). Missing when untagged or before update 42. */
  stormId?: string;
  corrected: boolean;
  correctionReason?: string;
}

/** Shifts the caller can see (own for workers, everyone's for owner/admin), newest first. */
export async function loadShifts(sinceIso: string, untilIso?: string): Promise<Result<SnowShift[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const run = (columns: string) => {
    let q = supabase.from('snow_shifts').select(columns).gte('clock_in_at', sinceIso);
    if (untilIso) q = q.lt('clock_in_at', untilIso);
    return q.order('clock_in_at', { ascending: false });
  };
  const corrections = 'snow_shift_corrections(clock_in_at, clock_out_at, reason, created_at)';
  let { data, error } = await run(`id, person_id, storm_id, clock_in_at, clock_out_at, ${corrections}`);
  // Before update 42 there is no storm_id column: load the shifts without it (every shift is untagged).
  if (error && /storm_id/i.test(error.message)) {
    ({ data, error } = await run(`id, person_id, clock_in_at, clock_out_at, ${corrections}`));
  }
  if (error) return fail(message(error, 'Couldn\'t load shifts.'));
  return ok(((data ?? []) as any[]).map((s) => {
    const fixes = ((s.snow_shift_corrections ?? []) as { clock_in_at: string; clock_out_at: string | null; reason: string; created_at: string }[])
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = fixes[fixes.length - 1];
    return {
      id: s.id,
      personId: s.person_id,
      clockInAt: last?.clock_in_at ?? s.clock_in_at,
      clockOutAt: (last ? last.clock_out_at : s.clock_out_at) ?? undefined,
      originalIn: s.clock_in_at,
      originalOut: s.clock_out_at ?? undefined,
      stormId: s.storm_id ?? undefined,
      corrected: !!last,
      correctionReason: last?.reason,
    };
  }));
}

export async function clockIn(): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.rpc('snow_clock_in', { p_client_request_id: uuid() });
  return error ? fail(message(error, 'Couldn\'t clock in.')) : ok(undefined);
}

export async function clockOut(): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.rpc('snow_clock_out');
  return error ? fail(message(error, 'Couldn\'t clock out.')) : ok(undefined);
}

export async function correctShift(shiftId: string, clockInAt: string, clockOutAt: string | null, reason: string): Promise<Result> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { error } = await supabase.rpc('snow_correct_shift', {
    p_shift_id: shiftId, p_clock_in_at: clockInAt, p_clock_out_at: clockOutAt, p_reason: reason,
  });
  return error ? fail(message(error, 'Couldn\'t correct the shift.')) : ok(undefined);
}

/** Hours worked, counting an open shift up to now. */
export function shiftHours(s: Pick<SnowShift, 'clockInAt' | 'clockOutAt'>, now = Date.now()): number {
  const end = s.clockOutAt ? new Date(s.clockOutAt).getTime() : now;
  return Math.max(0, end - new Date(s.clockInAt).getTime()) / 3_600_000;
}

export const formatHours = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;

export const formatClock = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Monday 00:00 of the current week, local time. */
export function startOfWeekIso(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}
