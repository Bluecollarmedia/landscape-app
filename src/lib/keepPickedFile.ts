/**
 * Copies a file the person just picked (photo library or camera) into the app's own folder straight away.
 *
 * The picker hands over a temporary copy that the phone is free to clear while the app is still busy (checking storage, waiting for a
 * Save tap, compressing), which left uploads failing with "the file is gone". A copy in the app's own folder stays until the app is
 * finished with it: the upload queue deletes it after a successful upload, and anything that never reaches the queue is swept away
 * after a few days (sweepKeptFiles, called when the queue starts).
 *
 * Two ways to make the copy, in order: a plain file copy, then (photos only) re-saving the picture through the image library the app
 * already uses to prepare photos, which can read picker files the plain copy cannot. If both fail the reason is returned.
 */
import { Platform } from 'react-native';

const PREFIX = 'pick-';
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

const extOf = (uri: string, kind: 'image' | 'video') =>
  (uri.split('?')[0].match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
const whyOf = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 120);

export interface KeptFile { uri?: string; why?: string }

/** The kept copy's address, or the reason it could not be made. Never throws. */
export async function keepPickedFileAsync(uri: string, kind: 'image' | 'video' = 'image'): Promise<KeptFile> {
  if (Platform.OS === 'web' || !uri || /^(https?|data|blob):/i.test(uri) || uri.includes('/media-queue/')) return { uri };
  let why = '';
  try {
    const { File, Directory, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const dir = new Directory(Paths.document, 'media-queue');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extOf(uri, kind)}`);
    try {
      new File(uri).copy(dest);
      if (dest.exists) return { uri: dest.uri };
      why = 'the copy did not appear';
    } catch (e) {
      why = whyOf(e);
    }
    if (kind === 'image') {
      try {
        const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
        const ref = await ImageManipulator.manipulate(uri).renderAsync();
        const saved = await ref.saveAsync({ compress: 1, format: SaveFormat.JPEG });
        const out = new File(dir, `${PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`);
        try { new File(saved.uri).copy(out); if (out.exists) { try { new File(saved.uri).delete(); } catch { /* cache */ } return { uri: out.uri }; } } catch { /* use it where it is */ }
        return { uri: saved.uri };
      } catch (e) {
        why = `${why}; ${whyOf(e)}`;
      }
    }
  } catch (e) {
    why = `${why}; ${whyOf(e)}`.replace(/^; /, '');
  }
  return { why: `${why || 'unknown'} · ...${uri.slice(-40)}` };
}

/** Like keepPickedFileAsync, but falls back to the original address so a screen that never failed before keeps working as it did. */
export async function keepPicked(uri: string, kind: 'image' | 'video' = 'image'): Promise<string> {
  return (await keepPickedFileAsync(uri, kind)).uri ?? uri;
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
