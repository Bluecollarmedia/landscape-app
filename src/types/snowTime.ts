/**
 * Snow Mode time clock. Tables and functions in supabase/updates/028_snow_shifts.sql.
 *
 * One shift = one Clock In and one Clock Out. No breaks, no GPS. Separate from
 * landscaping time (work_sessions), which never includes snow shifts.
 *
 * The employee's own taps are kept in recordedClockInAt / recordedClockOutAt.
 * clockInAt / clockOutAt are the current times after any owner correction;
 * hours are worked from those. Every correction is a SnowShiftCorrection row.
 */

export type SnowShiftStatus = 'open' | 'closed' | 'voided';

export interface SnowShift {
  id: string;
  companyId: string;
  personId: string;
  clockInAt: string;
  /** Empty while the shift is open (and on a voided shift that was never closed). */
  clockOutAt?: string;
  /** What the employee tapped. Never changed by a correction. */
  recordedClockInAt: string;
  /** Empty if the employee never tapped Clock Out (e.g. the owner closed it). */
  recordedClockOutAt?: string;
  status: SnowShiftStatus;
  correctionCount: number;
  lastCorrectedAt?: string;
  lastCorrectedBy?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnowShiftTimes {
  clockInAt?: string;
  clockOutAt?: string;
  status: SnowShiftStatus;
}

export interface SnowShiftCorrection {
  id: string;
  companyId: string;
  shiftId: string;
  /** Whose shift was corrected. */
  personId: string;
  kind: 'times' | 'void';
  reason: string;
  before: SnowShiftTimes;
  after: SnowShiftTimes;
  correctedBy?: string;
  correctedAt: string;
}

/** One row of the owner's time review (snow_time_records). */
export interface SnowTimeRecord {
  shiftId: string;
  personId: string;
  personName?: string;
  clockInAt: string;
  clockOutAt?: string;
  recordedClockInAt: string;
  recordedClockOutAt?: string;
  status: SnowShiftStatus;
  /** Open shifts count up to now; voided shifts count 0. */
  workedMinutes: number;
  correctionCount: number;
  lastCorrectedAt?: string;
}
