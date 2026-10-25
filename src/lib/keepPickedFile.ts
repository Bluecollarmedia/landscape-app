/**
 * Copies a file the person just picked (photo library or camera) into the app's own folder straight away.
 *
 * The picker hands over a temporary copy that the phone is free to clear while the app is still busy (checking storage, waiting for a
 * Save tap, compressing), which left uploads failing with "the file is gone". A copy in the app's own folder stays until the app is
 * finished with it: the upload queue deletes it after a successful upload, and anything that never reaches the queue is swept away
 * after a few days (sweepKeptFiles, called when the queue starts).
 *
 * Never throws: when the copy cannot be made the original address is returned, exactly as before.
 */
import { Platform } from 'react-native';

const PREFIX = 'pick-';
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

const extOf = (uri: string, kind: 'image' | 'video') =>
  (uri.split('?')[0].match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();

/** The kept copy's address, or undefined when the file could not be read at all. */
export function copyPickedFile(uri: string, kind: 'image' | 'video' = 'image'): string | undefined {
  if (Platform.OS === 'web' || !uri || /^(https?|data|blob):/i.test(uri) || uri.includes('/media-queue/')) return uri;
  try {
    const { File, Directory, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const dir = new Directory(Paths.document, 'media-queue');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extOf(uri, kind)}`);
    new File(uri).copy(dest);
    return dest.exists ? dest.uri : undefined;
  } catch {
    return undefined;
  }
}

/** Like copyPickedFile, but falls back to the original address so a screen that never failed before keeps working as it did. */
export function keepPicked(uri: string, kind: 'image' | 'video' = 'image'): string {
  return copyPickedFile(uri, kind) ?? uri;
}

/** Deletes kept copies older than a few days, except any a pending upload still needs. */
export function sweepKeptFiles(stillNeeded: Array<string | undefined>): void {
  if (Platform.OS === 'web') return;
  try {
    const { File, Directory, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const dir = new Directory(Paths.document, 'media-queue');
    if (!dir.exists) return;
    const needed = new Set(stillNeeded.filter((u): u is string => !!u));
    const now = Date.now();
    for (const item of dir.list()) {
      if (!(item instanceof File) || !item.name.startsWith(PREFIX)) continue;
      const stamp = parseInt(item.name.slice(PREFIX.length).split('-')[0], 36);
      if (!Number.isFinite(stamp) || now - stamp < KEEP_MS || needed.has(item.uri)) continue;
      try { item.delete(); } catch { /* already gone */ }
    }
  } catch { /* housekeeping only */ }
}
