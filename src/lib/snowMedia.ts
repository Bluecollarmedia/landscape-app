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
  const { contentType, ext } = contentTypeOf(localUri, mimeType);
  const key = `${folder}/${uuid()}.${ext}`;

  let body: Blob | FormData;
  if (Platform.OS === 'web') {
    body = await (await fetch(localUri)).blob();
  } else {
    const form = new FormData();
    form.append('file', { uri: localUri, name: key.split('/').pop(), type: contentType } as unknown as Blob);
    body = form;
  }
  const { error } = await supabase.storage.from(SNOW_MEDIA_BUCKET).upload(key, body, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return key;
}

/** Removes an upload that was never saved as media (the database refuses saved ones). */
export async function discardSnowUpload(key: string): Promise<void> {
  const { error } = await supabase.storage.from(SNOW_MEDIA_BUCKET).remove([key]);
  if (error) console.warn('[snow media] cleanup failed', error.message);
}

/**
 * Signed links for the given keys. Keys the caller isn't allowed to see come
 * back without a link, so they are simply left out.
 */
export async function signedSnowMediaUrls(keys: string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured || keys.length === 0) return {};
  const { data, error } = await supabase.storage.from(SNOW_MEDIA_BUCKET).createSignedUrls(keys, SIGNED_URL_SECONDS);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
  }
  return out;
}
