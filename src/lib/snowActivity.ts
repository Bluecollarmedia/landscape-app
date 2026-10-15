/**
 * Words for the Snow Mode activity log (supabase/updates/029).
 *
 * The database records actions as '<entity>.<verb>' (storm.dispatched,
 * visit.completed, route.lead_changed …). Snow tables are logged
 * automatically, so new entities and verbs can appear before this file knows
 * them; those fall back to readable words built from the action itself.
 */

import type { Feather } from '@expo/vector-icons';

type IconName = keyof typeof Feather.glyphMap;

const ENTITY_LABEL: Record<string, string> = {
  storm: 'Storm',
  route: 'Route',
  visit: 'Stop',
  property: 'Property',
  property_service: 'Property service',
  property_contact: 'Property contact',
  property_media: 'Reference media',
  reference_media: 'Reference media',
  completion_media: 'Completion media',
  visit_media: 'Completion media',
  media: 'Media',
  skip_request: 'Skip request',
  time_entry: 'Time entry',
  shift: 'Shift',
  time_correction: 'Time correction',
  notification: 'Notification',
  customer_notification: 'Customer notification',
  route_template: 'Route template',
  setting: 'Snow setting',
  signup_code: 'Snow signup code',
  signup_request: 'Snow access request',
  staff: 'Snow team member',
  staff_service: 'Snow service access',
};

/** Exact sentences for the actions the Owner will see most. */
const ACTION_LABEL: Record<string, string> = {
  'storm.created': 'Storm created',
  'storm.dispatched': 'Storm dispatched',
  'storm.ended': 'Storm ended',
  'storm.reopened': 'Storm reopened',
  'route.created': 'Route created',
  'route.lead_changed': 'Route lead changed',
  'route.deleted': 'Route removed',
  'visit.created': 'Stop added',
  'visit.reordered': 'Stop moved',
  'visit.arrived': 'Arrived at stop',
  'visit.completed': 'Stop completed',
  'visit.skipped': 'Stop skipped',
  'visit.deleted': 'Stop removed',
  'skip_request.created': 'Skip requested',
  'skip_request.approved': 'Skip approved',
  'skip_request.denied': 'Skip denied',
  'completion_media.created': 'Media uploaded',
  'completion_media.approved': 'Media approved for customer',
  'completion_media.removed': 'Media removed from customer selection',
  'completion_media.shared': 'Media shared with customer',
  'time_entry.created': 'Clocked in',
  'shift.created': 'Clocked in',
  'time_entry.clocked_out': 'Clocked out',
  'shift.clocked_out': 'Clocked out',
  'time_correction.created': 'Time corrected',
  'customer_notification.created': 'Customer notification queued',
  'customer_notification.delivered': 'Customer notification delivered',
  'customer_notification.failed': 'Customer notification failed',
  'staff.created': 'Added to snow team',
  'staff.active': 'Snow access restored',
  'staff.revoked': 'Snow access revoked',
  'staff_service.created': 'Snow service granted',
  'staff_service.deleted': 'Snow service removed',
  'customer_notification.unavailable': 'Customer notification not sent (no delivery set up)',
};

const VERB_LABEL: Record<string, string> = {
  created: 'added',
  updated: 'changed',
  deleted: 'removed',
  reordered: 'moved',
  lead_changed: 'lead changed',
  reassigned: 'reassigned',
  clocked_out: 'clocked out',
};

function humanize(s: string): string {
  return s.replace(/_/g, ' ');
}

export function entityLabel(entity: string): string {
  return ENTITY_LABEL[entity] ?? humanize(entity).replace(/^./, (c) => c.toUpperCase());
}

export function actionLabel(action: string): string {
  const exact = ACTION_LABEL[action];
  if (exact) return exact;
  const [entity, verb = ''] = action.split('.');
  return `${entityLabel(entity)} ${VERB_LABEL[verb] ?? humanize(verb)}`;
}

export function actionIcon(action: string): IconName {
  const [entity, verb] = action.split('.');
  if (verb === 'deleted' || verb === 'removed') return 'trash-2';
  if (verb === 'arrived') return 'map-pin';
  if (verb === 'completed' || verb === 'approved' || verb === 'delivered') return 'check-circle';
  if (verb === 'denied' || verb === 'failed') return 'x-circle';
  if (verb === 'reordered') return 'list';
  if (verb === 'lead_changed' || verb === 'reassigned') return 'user-check';
  if (verb === 'shared') return 'share';
  if (entity === 'storm') return 'cloud-snow';
  if (entity === 'route') return 'navigation';
  if (entity.includes('media')) return 'image';
  if (entity === 'skip_request') return 'skip-forward';
  if (entity === 'time_entry' || entity === 'shift' || entity === 'time_correction') return 'clock';
  if (entity.includes('notification')) return 'bell';
  if (entity === 'property' || entity.startsWith('property_')) return 'home';
  return 'activity';
}

/** Fields that are bookkeeping, not something the Owner changed. */
const HIDDEN_FIELDS = new Set(['id', 'company_id', 'created_at', 'updated_at']);

function showValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'empty';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'string') {
    // Timestamps read better as a local time.
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      }
    }
    return v;
  }
  return JSON.stringify(v);
}

export interface FieldChange {
  field: string;
  before?: string;
  after?: string;
}

/**
 * The before/after lines for one event. Updates list each changed field;
 * creates and deletes list the record's fields. Person and record ids are
 * left as-is (the screen shows names for the filter dimensions).
 */
export function fieldChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldChange[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: FieldChange[] = [];
  for (const k of keys) {
    if (HIDDEN_FIELDS.has(k)) continue;
    const b = before && k in before ? showValue(before[k]) : undefined;
    const a = after && k in after ? showValue(after[k]) : undefined;
    if (before && after && b === a) continue;
    out.push({ field: humanize(k), before: b, after: a });
  }
  return out;
}
