/**
 * Snow reference photos/videos live in the private "snow-media" bucket
 * (supabase/updates/022), not the public "media" bucket: a plow lead must not
 * be able to open shoveling media just by having its link. Files are shown
 * through short-lived signed links that the database only issues to people
 * allowed to see that property service.
 *
 * Paths: {companyId}/reference/{propertyServiceId}/{random}.{ext}
 */

import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { uuid } from './ids';
import { r2Enabled, requireSession } from './media';
import { explainUploadError } from './uploadErrors';

export const SNOW_MEDIA_BUCKET = 'snow-media';

/** How long a signed link stays valid. Long enough to watch a video. */
const SIGNED_URL_SECONDS = 60 * 60;

function contentTypeOf(uri: string, mimeType?: string): { contentType: string; ext: string } {
  const lower = uri.split('?')[0].toLowerCase();
  const mime = (mimeType ?? '').toLowerCase();
  if (mime === 'video/quicktime' || lower.endsWith('.mov')) return { contentType: 'video/quicktime', ext: 'mov' };
  if (mime.startsWith('video/') || lower.endsWith('.mp4') || lower.endsWith('.m4v')) return { contentType: 'video/mp4', ext: 'mp4' };
  if (mime === 'image/png' || lower.endsWith('.png')) return { contentType: 'image/png', ext: 'png' };
  if (mime === 'image/webp' || lower.endsWith('.webp')) return { contentType: 'image/webp', ext: 'webp' };
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return { contentType: 'image/heic', ext: 'heic' };
  return { contentType: 'image/jpeg', ext: 'jpg' };
}

export function snowReferenceFolder(companyId: string, propertyServiceId: string): string {
  return `${companyId}/reference/${propertyServiceId}`;
}

/** Uploads a local photo/video to the private bucket and returns its key. */
export async function uploadSnowMedia(localUri: string, folder: string, mimeType?: string): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Snow media needs the live database.');
  let { contentType, ext } = contentTypeOf(localUri, mimeType);
  await requireSession();
  // Photos are compressed like everywhere else (about 50% quality, long side at most 1600 px). Videos are not compressed here yet
  // (see mediaCompress.ts: needs the video library added to the app).
  if (contentType.startsWith('image/')) {
    const { prepareImage, isPrepared } = require('./mediaCompress') as typeof import('./mediaCompress');
    if (!isPrepared(localUri)) {
      const p = await prepareImage({ sourceUri: localUri, mimeType: contentType } as import('./mediaQueue').MediaJob);
      if (p.uri !== localUri) { localUri = p.uri; contentType = 'image/jpeg'; ext = 'jpg'; }
    }
  }
  const key = `${folder}/${uuid()}.${ext}`;

  if (r2Enabled) {
    // The real file goes to R2. A 1-byte stand-in goes to the private bucket so
    // the database's existing permission rules decide who may write and read it.
    const { error: standInError } = await supabase.storage
      .from(SNOW_MEDIA_BUCKET)
      .upload(key, new Uint8Array([0]).buffer, { contentType, upsert: false });
    if (standInError) throw new Error(`Upload failed: ${explainUploadError(standInError.message)}`);
    try {
      const blob = await (await fetch(localUri)).blob();
      const { data, error } = await supabase.functions.invoke('media', { body: { action: 'snow-put', key, contentType } });
      if (error || !data?.uploadUrl) throw new Error(error?.message ?? data?.error ?? 'no upload link');
      const res = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
      if (!res.ok) throw new Error('Please check your connection and try again.');
    } catch (err) {
      await supabase.storage.from(SNOW_MEDIA_BUCKET).remove([key]);
      throw new Error(`Upload failed: ${explainUploadError(err)}`);
    }
    return key;
  }

  let body: Blob | FormData;
  if (Platform.OS === 'web') {
    body = await (await fetch(localUri)).blob();
  } else {
    const form = new FormData();
    form.append('file', { uri: localUri, name: key.split('/').pop(), type: contentType } as unknown as Blob);
    body = form;
  }
  let uploadError: { message: string } | null = null;
  try {
    ({ error: uploadError } = await supabase.storage.from(SNOW_MEDIA_BUCKET).upload(key, body, { contentType, upsert: false }));
  } catch (err) {
    uploadError = { message: err instanceof Error ? err.message : String(err) };
  }
  if (uploadError) throw new Error(`Upload failed: ${explainUploadError(uploadError.message)}`);
  return key;
}

/** Removes an upload that was never saved as media (the database refuses saved ones). */
export async function discardSnowUpload(key: string): Promise<void> {
  const { error } = await supabase.storage.from(SNOW_MEDIA_BUCKET).remove([key]);
  if (error) console.warn('[snow media] cleanup failed', error.message);
  if (r2Enabled) {
    const { error: r2Error } = await supabase.functions.invoke('media', { body: { action: 'snow-delete', key } });
    if (r2Error) console.warn('[snow media] R2 cleanup failed', r2Error.message);
  }
}

/**
 * Signed links for the given keys. Keys the caller isn't allowed to see come
 * back without a link, so they are simply left out.
 */
export async function signedSnowMediaUrls(keys: string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured || keys.length === 0) return {};
  if (r2Enabled) {
    const { data, error } = await supabase.functions.invoke('media', { body: { action: 'snow-sign', keys } });
    if (error) throw new Error(error.message);
    return (data?.urls ?? {}) as Record<string, string>;
  }
  const { data, error } = await supabase.storage.from(SNOW_MEDIA_BUCKET).createSignedUrls(keys, SIGNED_URL_SECONDS);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
  }
  return out;
}
