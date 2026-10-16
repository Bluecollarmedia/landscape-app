/**
 * Snow Mode time clock. Screens call these instead of touching tables.
 *
 *  • Clock In / Clock Out go through database functions (update 028) so a
 *    double tap or a retry never makes a second shift, and only approved snow
 *    employees can clock in. No location is read or sent.
 *  • Owner corrections and voids need a reason; the database keeps the
 *    employee's original taps and an append-only correction history, and
 *    writes each action to the snow activity log.
 *  • Snow tables aren't part of the landscaping store; they are read here
 *    directly, so snow time never mixes into landscaping hours or payroll.
 *
 * There is no demo/offline stand-in: without the live database these return
 * an error instead of pretending a shift was saved.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uuid } from '@/lib/ids';
import type { SnowShift, SnowShiftCorrection, SnowShiftStatus, SnowShiftTimes, SnowTimeRecord } from '@/types/snowTime';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

const NOT_CONNECTED = 'The snow time clock needs the live database, which isn\'t connected in this version of the app.';

type Row = Record<string, any>;

const opt = <T,>(v: T | null | undefined) => (v == null ? undefined : v);

export function toSnowShift(r: Row): SnowShift {
  return {
    id: r.id,
    companyId: r.company_id,
    personId: r.person_id,
    clockInAt: r.clock_in_at,
    clockOutAt: opt(r.clock_out_at),
    recordedClockInAt: r.recorded_clock_in_at,
    recordedClockOutAt: opt(r.recorded_clock_out_at),
    status: r.status as SnowShiftStatus,
    correctionCount: r.correction_count ?? 0,
    lastCorrectedAt: opt(r.last_corrected_at),
    lastCorrectedBy: opt(r.last_corrected_by),
    voidedAt: opt(r.voided_at),
    voidedBy: opt(r.voided_by),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const toTimes = (j: Row | null): SnowShiftTimes => ({
  clockInAt: opt(j?.clock_in_at),
  clockOutAt: opt(j?.clock_out_at),
  status: (j?.status ?? 'closed') as SnowShiftStatus,
});

export function toSnowShiftCorrection(r: Row): SnowShiftCorrection {
  return {
    id: r.id,
    companyId: r.company_id,
    shiftId: r.shift_id,
    personId: r.person_id,
    kind: r.kind,
    reason: r.reason,
    before: toTimes(r.before),
    after: toTimes(r.after),
    correctedBy: opt(r.corrected_by),
    correctedAt: r.corrected_at,
  };
}

function toTimeRecord(r: Row): SnowTimeRecord {
  return {
    shiftId: r.shift_id,
    personId: r.person_id,
    personName: opt(r.person_name),
    clockInAt: r.clock_in_at,
    clockOutAt: opt(r.clock_out_at),
    recordedClockInAt: r.recorded_clock_in_at,
    recordedClockOutAt: opt(r.recorded_clock_out_at),
    status: r.status,
    workedMinutes: Number(r.worked_minutes ?? 0),
    correctionCount: r.correction_count ?? 0,
    lastCorrectedAt: opt(r.last_corrected_at),
  };
}

// ── The employee ────────────────────────────────────────────────────────────

/** The caller's open shift, or undefined when they're clocked out. */
export async function getMyOpenShift(companyId: string, personId: string): Promise<Result<SnowShift | undefined>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_shifts')
    .select('*')
    .eq('company_id', companyId)
    .eq('person_id', personId)
    .eq('status', 'open')
    .maybeSingle();
  if (error) return fail(error.message);
  return ok(data ? toSnowShift(data) : undefined);
}

/** The caller's own recent shifts, newest first (RLS shows nobody else's). */
export async function listMyShifts(companyId: string, personId: string, limit = 30): Promise<Result<SnowShift[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_shifts')
    .select('*')
    .eq('company_id', companyId)
    .eq('person_id', personId)
    .order('clock_in_at', { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok((data ?? []).map(toSnowShift));
}

/** A fresh id for one Clock In / Clock Out tap. Reuse it when retrying that tap. */
export const newClockRequestId = () => uuid();

/**
 * Clock In. Returns the open shift: a new one, or the one already open if the
 * employee was clocked in. Retrying with the same requestId is safe.
 */
export async function clockIn(companyId: string, requestId: string): Promise<Result<SnowShift>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_clock_in', { p_company_id: companyId, p_request_id: requestId });
  if (error) return fail(error.message);
  return ok(toSnowShift(data as Row));
}

/** Clock Out of the open shift. Retrying with the same requestId is safe. */
export async function clockOut(companyId: string, requestId: string): Promise<Result<SnowShift>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_clock_out', { p_company_id: companyId, p_request_id: requestId });
  if (error) return fail(error.message);
  return ok(toSnowShift(data as Row));
}

// ── Owner/admin ─────────────────────────────────────────────────────────────

/** Shifts that started in [from, to), with names and worked minutes. */
export async function listTimeRecords(companyId: string, from: Date, to: Date): Promise<Result<SnowTimeRecord[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_time_records', {
    p_company_id: companyId, p_from: from.toISOString(), p_to: to.toISOString(),
  });
  if (error) return fail(error.message);
  return ok(((data as Row[]) ?? []).map(toTimeRecord));
}

/** Every correction made to one shift, oldest first. */
export async function listShiftCorrections(shiftId: string): Promise<Result<SnowShiftCorrection[]>> {
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase
    .from('snow_shift_corrections')
    .select('*')
    .eq('shift_id', shiftId)
    .order('corrected_at', { ascending: true });
  if (error) return fail(error.message);
  return ok((data ?? []).map(toSnowShiftCorrection));
}

/**
 * Set a shift's clock-in and clock-out. Leave clockOutAt empty only to keep an
 * open shift running; giving one closes it (e.g. someone forgot to clock out).
 */
export async function correctShift(
  shiftId: string,
  clockInAt: Date,
  clockOutAt: Date | undefined,
  reason: string,
): Promise<Result<SnowShift>> {
  if (!reason.trim()) return fail('Add a reason for the correction.');
  if (clockOutAt && clockOutAt <= clockInAt) return fail('Clock-out must be after clock-in.');
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_correct_shift', {
    p_shift_id: shiftId,
    p_clock_in_at: clockInAt.toISOString(),
    p_clock_out_at: clockOutAt ? clockOutAt.toISOString() : null,
    p_reason: reason.trim(),
  });
  if (error) return fail(error.message);
  return ok(toSnowShift(data as Row));
}

/** Void a shift that shouldn't count. It stays on record as voided. */
export async function voidShift(shiftId: string, reason: string): Promise<Result<SnowShift>> {
  if (!reason.trim()) return fail('Add a reason for voiding this shift.');
  if (!isSupabaseConfigured) return fail(NOT_CONNECTED);
  const { data, error } = await supabase.rpc('snow_void_shift', { p_shift_id: shiftId, p_reason: reason.trim() });
  if (error) return fail(error.message);
  return ok(toSnowShift(data as Row));
}

/** Minutes worked on a shift right now (open shifts count up to now). */
export function shiftMinutes(s: Pick<SnowShift, 'clockInAt' | 'clockOutAt' | 'status'>, now: Date = new Date()): number {
  if (s.status === 'voided') return 0;
  const end = s.clockOutAt ? new Date(s.clockOutAt) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(s.clockInAt).getTime()) / 60000));
}
