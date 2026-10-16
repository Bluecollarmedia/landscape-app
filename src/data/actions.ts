/**
 * Shared write helpers used by several hooks/screens: history log, customer
 * timeline, owner notifications, and photo records (with upload).
 */

import { db, insertRow, insertRows, saveDeferredRow, discardLocalRow, updateRow, type TableName } from './store';
import { uploadImage } from '@/lib/media';
import type { HistoryEventType, CustomerTimelineType, ProjectPhoto } from '@/types/project';
import type { NotificationEventType, AppNotification } from '@/types/operations';

/** Appends to a project's internal activity log. */
export function logProjectHistory(projectId: string, eventType: HistoryEventType, description: string, metadata?: Record<string, unknown>) {
  insertRow('project_history', {
    projectId,
    actorId: db.personId || undefined,
    eventType,
    description,
    metadata,
  });
}

/** Adds an entry the customer sees on their project timeline. */
export function addCustomerTimeline(projectId: string, eventType: CustomerTimelineType, title: string, description?: string, photoUrl?: string) {
  insertRow('customer_timeline', {
    projectId,
    eventType,
    title,
    description,
    photoUrl,
    timestamp: new Date().toISOString(),
  });
}

/**
 * In-app notification for the owner/admins (the bell / Notification Center),
 * respecting the company's notification settings: the company default for
 * the event, or the per-worker setting when the event is about a worker.
 */
export function notifyStaff(
  eventType: NotificationEventType,
  title: string,
  body: string,
  link?: { type: AppNotification['linkedEntityType']; id: string },
  metadata?: Record<string, unknown>,
  aboutPersonId?: string,
) {
  const override = aboutPersonId
    ? db.notificationPreferences.find((p) => p.personId === aboutPersonId && p.eventType === eventType)
    : undefined;
  const def = db.notificationPreferences.find((p) => !p.personId && p.eventType === eventType);
  if (!(override ? override.enabled : def?.enabled ?? true)) return;

  const staff = db.members.filter((m) => (m.role === 'owner' || m.role === 'admin') && m.status === 'active');
  const rows = staff
    .filter((m) => m.personId !== db.personId)
    .map((m) => ({
      recipientId: m.personId,
      eventType,
      title,
      body,
      status: 'unread',
      linkedEntityType: link?.type,
      linkedEntityId: link?.id,
      metadata,
    }));
  insertRows('app_notifications', rows);
}

/** In-app notifications for specific people (e.g. workers for an announcement). */
export function notifyPeople(
  personIds: string[],
  eventType: NotificationEventType,
  title: string,
  body: string,
  link?: { type: AppNotification['linkedEntityType']; id: string },
  metadata?: Record<string, unknown>,
) {
  insertRows('app_notifications', personIds.map((recipientId) => ({
    recipientId,
    eventType,
    title,
    body,
    status: 'unread',
    linkedEntityType: link?.type,
    linkedEntityId: link?.id,
    metadata,
  })));
}

export type NewPhoto = Omit<ProjectPhoto, 'id' | 'createdAt' | 'uploader' | 'sharer' | 'taskTitle' | 'fileKey'> & { fileKey?: string; id?: string };

/**
 * Creates a photo record right away (showing the local image) and uploads the
 * file in the background, then points the record at the uploaded copy so
 * everyone else can see it. If the upload fails the record is removed.
 */
export function addProjectPhoto(input: NewPhoto): ProjectPhoto {
  const localUri = input.fileUrl;
  const needsUpload = !db.demo && !!localUri && !/^https?:\/\//i.test(localUri);
  const row = insertRow('project_photos', {
    ...input,
    fileKey: input.fileKey ?? '',
    uploadedBy: input.uploadedBy || db.personId,
  }, { deferSave: needsUpload }) as unknown as ProjectPhoto;

  if (needsUpload) {
    // Shown locally right away; saved for everyone once the file is uploaded.
    uploadImage(localUri, `${db.companyId}/projects/${input.projectId}`)
      .then(({ url, key }) => saveDeferredRow('project_photos', row.id, { fileUrl: url, fileKey: key }))
      .catch((err) => {
        console.warn('[photos] upload failed', err);
        discardLocalRow('project_photos', row.id);
        const { Alert, Platform } = require('react-native');
        const msg = `The photo couldn't be uploaded. ${err?.message ?? ''}`.trim();
        if (Platform.OS === 'web') (globalThis as { alert?: (m: string) => void }).alert?.(msg);
        else Alert.alert('Photo not saved', msg);
      });
  }
  return row;
}

/**
 * Uploads a picked image and stores its URL on an existing row (e.g. a
 * truck's photo). The local image shows right away.
 */
export function attachImage(table: TableName, id: string, field: string, localUri: string | undefined, folder: string) {
  if (!localUri) return;
  if (db.demo || /^https?:\/\//i.test(localUri)) {
    updateRow(table, id, { [field]: localUri });
    return;
  }
  uploadImage(localUri, `${db.companyId}/${folder}`)
    .then(({ url }) => updateRow(table, id, { [field]: url }))
    .catch((err) => {
      console.warn('[photos] upload failed', err);
      const { Alert, Platform } = require('react-native');
      const msg = `The photo couldn't be uploaded. ${err?.message ?? ''}`.trim();
      if (Platform.OS === 'web') (globalThis as { alert?: (m: string) => void }).alert?.(msg);
      else Alert.alert('Photo not saved', msg);
    });
}
