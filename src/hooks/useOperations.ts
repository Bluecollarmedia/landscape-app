import { useMemo, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import type {
  WorkSession,
  WorkerHourlyRate,
  OvertimeRule,
  NotificationPreference,
  AppNotification,
  CompanyOperationsSettings,
  WorkerAttendance,
  AttendanceStatus,
  WorkerReminder,
  NotificationEventType,
} from '@/types/operations';
import type { Assignment } from '@/types/schedule';
import type { PersonSummary } from '@/types/company';
import {
  mockWorkSessions,
  mockHourlyRates,
  mockOvertimeRule,
  mockNotificationPreferences,
  mockNotifications,
  mockOperationsSettings,
  mockWorkerReminders,
  mockExpandedCheckIns,
} from '@/data/mockOperations';
import { mockAssignments, mockMembers, mockCheckIns } from '@/data/mock';

const today = new Date().toISOString().split('T')[0];

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Hours Calculation ─────────────────────────────────────────

export interface DailyHours {
  date: string;
  sessions: WorkSession[];
  totalMinutes: number;
  totalHours: number;
}

export interface WorkerWeeklyHours {
  personId: string;
  worker: PersonSummary;
  weekStart: string;
  weekEnd: string;
  dailyHours: DailyHours[];
  totalMinutes: number;
  totalHours: number;
}

function getWeekRange(referenceDate: string): { start: string; end: string } {
  const d = new Date(referenceDate + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function getSessionDate(session: WorkSession): string {
  return session.checkInTime.split('T')[0];
}

export function useWorkSessions() {
  const [sessions] = useState<WorkSession[]>(mockWorkSessions);

  const getSessionsForWorker = useCallback(
    (personId: string, startDate?: string, endDate?: string) => {
      return sessions.filter((s) => {
        if (s.personId !== personId) return false;
        const date = getSessionDate(s);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      });
    },
    [sessions],
  );

  const getSessionsForDate = useCallback(
    (date: string) => sessions.filter((s) => getSessionDate(s) === date),
    [sessions],
  );

  const getWeeklyHoursForWorker = useCallback(
    (personId: string, weekOfDate: string): WorkerWeeklyHours | null => {
      const { start, end } = getWeekRange(weekOfDate);
      const workerSessions = getSessionsForWorker(personId, start, end);
      const worker = mockMembers.find((m) => m.personId === personId)?.person;
      if (!worker) return null;

      const dailyMap: Record<string, WorkSession[]> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(start + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() + i);
        dailyMap[d.toISOString().split('T')[0]] = [];
      }
      for (const s of workerSessions) {
        const date = getSessionDate(s);
        if (dailyMap[date]) dailyMap[date].push(s);
      }

      const dailyHours: DailyHours[] = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, daySessions]) => {
          const totalMinutes = daySessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
          return { date, sessions: daySessions, totalMinutes, totalHours: Math.round((totalMinutes / 60) * 100) / 100 };
        });

      const totalMinutes = dailyHours.reduce((sum, d) => sum + d.totalMinutes, 0);
      return {
        personId,
        worker,
        weekStart: start,
        weekEnd: end,
        dailyHours,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      };
    },
    [getSessionsForWorker],
  );

  const getAllWorkersWeeklyHours = useCallback(
    (weekOfDate: string): WorkerWeeklyHours[] => {
      const workerIds = [...new Set(sessions.map((s) => s.personId))];
      const allMembers = mockMembers.filter((m) => m.role === 'worker' && m.status === 'active');
      return allMembers
        .map((m) => getWeeklyHoursForWorker(m.personId, weekOfDate))
        .filter((w): w is WorkerWeeklyHours => w !== null);
    },
    [sessions, getWeeklyHoursForWorker],
  );

  return { sessions, getSessionsForWorker, getSessionsForDate, getWeeklyHoursForWorker, getAllWorkersWeeklyHours };
}

// ── Payroll Estimates ─────────────────────────────────────────

export interface PayrollEstimate {
  personId: string;
  worker: PersonSummary;
  weekStart: string;
  weekEnd: string;
  regularHours: number;
  overtimeHours: number;
  regularRate: number;
  overtimeRate: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  sessions: WorkSession[];
}

function getRateForDate(rates: WorkerHourlyRate[], date: string): number {
  const applicable = rates
    .filter((r) => r.effectiveDate <= date && (!r.endDate || r.endDate >= date))
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return applicable[0]?.hourlyRate ?? 0;
}

export function usePayroll() {
  const [rates] = useState<WorkerHourlyRate[]>(mockHourlyRates);
  const [overtimeRule] = useState<OvertimeRule>(mockOvertimeRule);
  const { getAllWorkersWeeklyHours } = useWorkSessions();

  const getRatesForWorker = useCallback(
    (personId: string) => rates.filter((r) => r.personId === personId).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)),
    [rates],
  );

  const getCurrentRate = useCallback(
    (personId: string) => getRateForDate(getRatesForWorker(personId), today),
    [getRatesForWorker],
  );

  const getPayrollEstimates = useCallback(
    (weekOfDate: string): PayrollEstimate[] => {
      const allWeekly = getAllWorkersWeeklyHours(weekOfDate);

      return allWeekly.map((wh) => {
        const workerRates = getRatesForWorker(wh.personId);
        let regularHours = 0;
        let overtimeHours = 0;
        let regularPay = 0;
        let overtimePay = 0;

        if (overtimeRule.isActive && overtimeRule.ruleType === 'weekly_40') {
          const threshold = overtimeRule.weeklyThresholdHours ?? 40;
          let cumulativeHours = 0;

          for (const day of wh.dailyHours) {
            const dayRate = getRateForDate(workerRates, day.date);
            const dayHours = day.totalHours;

            if (cumulativeHours + dayHours <= threshold) {
              regularHours += dayHours;
              regularPay += dayHours * dayRate;
            } else if (cumulativeHours >= threshold) {
              overtimeHours += dayHours;
              overtimePay += dayHours * dayRate * overtimeRule.overtimeMultiplier;
            } else {
              const regPortion = threshold - cumulativeHours;
              const otPortion = dayHours - regPortion;
              regularHours += regPortion;
              overtimeHours += otPortion;
              regularPay += regPortion * dayRate;
              overtimePay += otPortion * dayRate * overtimeRule.overtimeMultiplier;
            }
            cumulativeHours += dayHours;
          }
        } else {
          for (const day of wh.dailyHours) {
            const dayRate = getRateForDate(workerRates, day.date);
            regularHours += day.totalHours;
            regularPay += day.totalHours * dayRate;
          }
        }

        const rate = getCurrentRate(wh.personId);
        return {
          personId: wh.personId,
          worker: wh.worker,
          weekStart: wh.weekStart,
          weekEnd: wh.weekEnd,
          regularHours: Math.round(regularHours * 100) / 100,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          regularRate: rate,
          overtimeRate: Math.round(rate * overtimeRule.overtimeMultiplier * 100) / 100,
          regularPay: Math.round(regularPay * 100) / 100,
          overtimePay: Math.round(overtimePay * 100) / 100,
          totalPay: Math.round((regularPay + overtimePay) * 100) / 100,
          sessions: mockWorkSessions.filter(
            (s) => s.personId === wh.personId && getSessionDate(s) >= wh.weekStart && getSessionDate(s) <= wh.weekEnd,
          ),
        };
      });
    },
    [getAllWorkersWeeklyHours, getRatesForWorker, getCurrentRate, overtimeRule],
  );

  return { rates, overtimeRule, getRatesForWorker, getCurrentRate, getPayrollEstimates };
}

// ── Attendance ────────────────────────────────────────────────

export function useAttendance() {
  const { sessions, getSessionsForDate } = useWorkSessions();
  const [settings] = useState<CompanyOperationsSettings>(mockOperationsSettings);

  const getAttendanceForDate = useCallback(
    (date: string): WorkerAttendance[] => {
      const dayAssignments = mockAssignments.filter(
        (a) => a.scheduledDate === date && a.status !== 'cancelled' && a.status !== 'reassigned',
      );
      const daySessions = getSessionsForDate(date);
      const allCheckIns = [...mockCheckIns, ...mockExpandedCheckIns];

      const workerIds = [...new Set(dayAssignments.map((a) => a.personId))];

      return workerIds.map((personId) => {
        const worker = mockMembers.find((m) => m.personId === personId)?.person;
        const workerAssignments = dayAssignments.filter((a) => a.personId === personId);
        const workerSessions = daySessions.filter((s) => s.personId === personId);

        const assignments = workerAssignments.map((a) => {
          const session = workerSessions.find((s) => s.assignmentId === a.id);
          const checkIn = allCheckIns.find((ci) => ci.assignmentId === a.id);

          let status: AttendanceStatus = 'not_checked_in';
          let lateMinutes: number | undefined;

          if (session) {
            if (session.checkOutTime) {
              status = 'checked_out';
            } else {
              const scheduledEnd = a.endTime;
              if (scheduledEnd) {
                const now = new Date();
                const [eh, em] = scheduledEnd.split(':').map(Number);
                const endToday = new Date(date + 'T12:00:00Z');
                endToday.setUTCHours(eh, em, 0);
                if (now > endToday) {
                  status = 'past_scheduled_end';
                } else {
                  status = 'checked_in';
                }
              } else {
                status = 'checked_in';
              }
            }

            if (a.startTime && session.checkInTime) {
              const [sh, sm] = a.startTime.split(':').map(Number);
              const scheduledStart = new Date(date + 'T12:00:00Z');
              scheduledStart.setUTCHours(sh, sm, 0);
              const actualIn = new Date(session.checkInTime);
              const diffMin = (actualIn.getTime() - scheduledStart.getTime()) / 60000;
              if (diffMin > settings.lateCheckinThresholdMinutes) {
                lateMinutes = Math.round(diffMin);
                if (status === 'checked_in') status = 'late';
              }
            }
          } else if (checkIn) {
            status = 'checked_in';
            if (a.startTime) {
              const [sh, sm] = a.startTime.split(':').map(Number);
              const scheduledStart = new Date(date + 'T12:00:00Z');
              scheduledStart.setUTCHours(sh, sm, 0);
              const actualIn = new Date(checkIn.timestamp);
              const diffMin = (actualIn.getTime() - scheduledStart.getTime()) / 60000;
              if (diffMin > settings.lateCheckinThresholdMinutes) {
                lateMinutes = Math.round(diffMin);
                status = 'late';
              }
            }
          }

          return {
            assignmentId: a.id,
            projectId: a.projectId,
            projectName: a.project?.name ?? 'Unknown',
            projectAddress: a.project?.address,
            scheduledStart: a.startTime,
            scheduledEnd: a.endTime,
            actualCheckIn: session?.checkInTime ?? checkIn?.timestamp,
            actualCheckOut: session?.checkOutTime,
            status,
            lateMinutes,
            distanceFromSite: checkIn?.gps?.distanceFromSite ?? session?.checkInGps?.distanceFromSite,
            withinRadius: checkIn?.withinRadius,
          };
        });

        return {
          personId,
          scheduledDate: date,
          assignments,
          worker,
        };
      });
    },
    [sessions, getSessionsForDate, settings],
  );

  return { getAttendanceForDate, settings };
}

// ── Notifications ─────────────────────────────────────────────

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const [preferences, setPreferences] = useState<NotificationPreference[]>(mockNotificationPreferences);

  // Other screens (e.g. sending an announcement) push directly into the
  // shared mockNotifications array — re-sync on focus so this list picks
  // those up instead of only reflecting whatever existed at first mount.
  useFocusEffect(
    useCallback(() => {
      setNotifications([...mockNotifications]);
    }, []),
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === 'unread').length,
    [notifications],
  );

  const markRead = useCallback((notificationId: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) =>
        n.id === notificationId
          ? { ...n, status: 'read' as const, readAt: new Date().toISOString() }
          : n,
      );
      mockNotifications.splice(0, mockNotifications.length, ...next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) =>
        n.status === 'unread'
          ? { ...n, status: 'read' as const, readAt: new Date().toISOString() }
          : n,
      );
      mockNotifications.splice(0, mockNotifications.length, ...next);
      return next;
    });
  }, []);

  const getCompanyDefault = useCallback(
    (eventType: NotificationEventType) =>
      preferences.find((p) => !p.personId && p.eventType === eventType),
    [preferences],
  );

  const getWorkerOverride = useCallback(
    (personId: string, eventType: NotificationEventType) =>
      preferences.find((p) => p.personId === personId && p.eventType === eventType),
    [preferences],
  );

  const isEnabledForWorker = useCallback(
    (personId: string, eventType: NotificationEventType): boolean => {
      const override = getWorkerOverride(personId, eventType);
      if (override) return override.enabled;
      const def = getCompanyDefault(eventType);
      return def?.enabled ?? true;
    },
    [getWorkerOverride, getCompanyDefault],
  );

  const updatePreference = useCallback(
    (prefId: string, enabled: boolean) => {
      setPreferences((prev) =>
        prev.map((p) =>
          p.id === prefId
            ? { ...p, enabled, updatedAt: new Date().toISOString() }
            : p,
        ),
      );
    },
    [],
  );

  const setWorkerOverride = useCallback(
    (personId: string, eventType: NotificationEventType, enabled: boolean) => {
      setPreferences((prev) => {
        const existing = prev.find((p) => p.personId === personId && p.eventType === eventType);
        if (existing) {
          return prev.map((p) =>
            p.id === existing.id ? { ...p, enabled, updatedAt: new Date().toISOString() } : p,
          );
        }
        return [
          ...prev,
          {
            id: `np_${Date.now()}`,
            companyId: 'company1',
            personId,
            eventType,
            enabled,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      });
    },
    [],
  );

  return {
    notifications,
    unreadCount,
    preferences,
    markRead,
    markAllRead,
    getCompanyDefault,
    getWorkerOverride,
    isEnabledForWorker,
    updatePreference,
    setWorkerOverride,
  };
}

// ── Worker Reminders ──────────────────────────────────────────

export function useWorkerReminders(personId?: string) {
  const [reminders] = useState<WorkerReminder[]>(mockWorkerReminders);

  const filtered = useMemo(
    () => (personId ? reminders.filter((r) => r.personId === personId) : reminders),
    [reminders, personId],
  );

  return { reminders: filtered };
}
