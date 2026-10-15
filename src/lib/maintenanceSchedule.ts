/**
 * Maintenance due / overdue. Pure functions: each service rule is judged on
 * its own schedule and its own history, never on the property's last visit.
 * When there isn't enough to go on, the answer is 'not_configured', not a guess.
 */
import { addDaysKey } from './recurrence';
import { isoToLocalDateKey } from './ids';
import type {
  DueStatus, MaintenanceContract, MaintenanceProperty, MaintenanceServiceRule,
  MaintenanceStopService, PropertyDueInfo, ServiceDueInfo,
} from '@/types/maintenance';

/** Days between two 'YYYY-MM-DD' keys (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function intervalDaysOf(rule: Pick<MaintenanceServiceRule, 'frequency' | 'intervalDays'>): number | undefined {
  if (rule.frequency === 'weekly') return 7;
  if (rule.frequency === 'biweekly') return 14;
  if (rule.frequency === 'every_n_days') return rule.intervalDays && rule.intervalDays > 0 ? rule.intervalDays : undefined;
  return undefined;
}

/** Most urgent first. */
const URGENCY: Record<DueStatus, number> = {
  overdue: 0, due: 1, upcoming: 2, not_configured: 3, not_scheduled: 4,
  done_for_season: 5, out_of_season: 6, inactive: 7,
};

export function compareUrgency(a: { status: DueStatus; daysOverdue?: number; dueDate?: string }, b: typeof a): number {
  return URGENCY[a.status] - URGENCY[b.status]
    || (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)
    || String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999'));
}

export interface DueOptions {
  /** The day being planned ('YYYY-MM-DD'), usually the route's service date. */
  onDate: string;
  /** Count as 'due' this many days early. Default 0. */
  lookAheadDays?: number;
}

/**
 * Where one service stands on `onDate`.
 * `history` = this rule's completed stop services.
 */
export function serviceDue(
  rule: MaintenanceServiceRule,
  contract: MaintenanceContract | undefined,
  property: MaintenanceProperty | undefined,
  history: MaintenanceStopService[],
  opts: DueOptions,
  scheduledOn?: string,
): ServiceDueInfo {
  const { onDate, lookAheadDays = 0 } = opts;
  const done = history.filter((h) => h.completed && h.completedAt);
  const historyDates = done.map((h) => isoToLocalDateKey(h.completedAt!)).sort();
  const lastFromHistory = historyDates[historyDates.length - 1];
  const lastServiceDate = [lastFromHistory, rule.lastCompletedOn].filter(Boolean).sort().pop();
  const completedCount = (rule.priorCompletedCount ?? 0) + done.length;
  const remainingCount = rule.seasonQuantity != null ? Math.max(0, rule.seasonQuantity - completedCount) : undefined;
  const base = { rule, lastServiceDate, completedCount, remainingCount, scheduledOn };

  if (!rule.isActive || !contract || contract.status !== 'active' || (property && !property.isActive)) {
    return { ...base, status: 'inactive' };
  }
  if (rule.seasonQuantity != null && completedCount >= rule.seasonQuantity) {
    return { ...base, status: 'done_for_season' };
  }
  if (rule.frequency === 'as_needed') return { ...base, status: 'not_scheduled' };

  if (rule.frequency === 'seasonal_window') {
    if (!rule.windowStart || !rule.windowEnd) return { ...base, status: 'not_configured' };
    // Once per season unless a quantity says otherwise (handled above). Any
    // visit that year counts, even a little early or late.
    const year = rule.windowStart.slice(0, 4);
    const doneInWindow = rule.seasonQuantity == null && (
      historyDates.some((d) => d.startsWith(year))
      || (!!rule.lastCompletedOn && rule.lastCompletedOn >= rule.windowStart && rule.lastCompletedOn <= rule.windowEnd)
    );
    if (doneInWindow) return { ...base, status: 'done_for_season' };
    if (onDate < rule.windowStart) return { ...base, status: 'upcoming', dueDate: rule.windowStart };
    if (onDate <= rule.windowEnd) return { ...base, status: 'due', dueDate: rule.windowEnd };
    return { ...base, status: 'overdue', dueDate: rule.windowEnd, daysOverdue: daysBetween(rule.windowEnd, onDate) };
  }

  if ((contract.seasonStart && onDate < contract.seasonStart) || (contract.seasonEnd && onDate > contract.seasonEnd)) {
    return { ...base, status: 'out_of_season' };
  }

  const interval = intervalDaysOf(rule);
  if (!interval) return { ...base, status: 'not_configured' };
  const dueDate = lastServiceDate ? addDaysKey(lastServiceDate, interval) : rule.startsOn;
  if (!dueDate) return { ...base, status: 'not_configured' };
  const late = daysBetween(dueDate, onDate);
  if (late > 0) return { ...base, status: 'overdue', dueDate, daysOverdue: late };
  if (late >= -lookAheadDays) return { ...base, status: 'due', dueDate };
  return { ...base, status: 'upcoming', dueDate };
}

/** A property's services, most urgent first, and its overall status. */
export function propertyDue(
  property: MaintenanceProperty,
  contract: MaintenanceContract | undefined,
  rules: MaintenanceServiceRule[],
  historyByRule: Record<string, MaintenanceStopService[]>,
  opts: DueOptions,
  scheduledByRule: Record<string, string> = {},
): PropertyDueInfo {
  const services = rules
    .map((r) => serviceDue(r, contract, property, historyByRule[r.id] ?? [], opts, scheduledByRule[r.id]))
    .sort(compareUrgency);
  const top = services[0];
  const lastServiceDate = services.map((s) => s.lastServiceDate).filter(Boolean).sort().pop();
  return {
    property,
    contract,
    services,
    status: top ? top.status : (contract ? 'not_configured' : 'inactive'),
    daysOverdue: top?.daysOverdue,
    lastServiceDate,
  };
}

/** Plain-English status, e.g. "Overdue by 5 days". */
export function dueLabel(info: Pick<ServiceDueInfo, 'status' | 'daysOverdue' | 'dueDate'>, onDate?: string): string {
  switch (info.status) {
    case 'overdue': return `Overdue by ${info.daysOverdue} day${info.daysOverdue === 1 ? '' : 's'}`;
    case 'due': return onDate && info.dueDate && info.dueDate > onDate ? `Due by ${info.dueDate}` : 'Due today';
    case 'upcoming': return info.dueDate ? `Next due ${info.dueDate}` : 'Upcoming';
    case 'done_for_season': return 'Done for the season';
    case 'not_configured': return 'Schedule not set';
    case 'not_scheduled': return 'As needed';
    case 'out_of_season': return 'Out of season';
    case 'inactive': return 'Inactive';
  }
}
