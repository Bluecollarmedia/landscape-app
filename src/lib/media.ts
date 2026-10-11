/**
 * Photo uploads (Supabase Storage).
 *
 * Photos taken in the app are uploaded to the public "media" bucket so every
 * phone sees the same picture. The bucket and its access rules are created by
 * supabase/schema.sql. (Cloudflare R2 via src/lib/storage.ts is the longer-term
 * plan for large volumes; this keeps photos working with no extra account.)
 *
 * In demo mode (no Supabase configured) the local file URI is returned as-is.
 */

import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { uuid } from './ids';

export const MEDIA_BUCKET = 'media';

function guessContentType(uri: string): { contentType: string; ext: string } {
  const lower = uri.split('?')[0].toLowerCase();
  if (lower.endsWith('.png')) return { contentType: 'image/png', ext: 'png' };
  if (lower.endsWith('.webp')) return { contentType: 'image/webp', ext: 'webp' };
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return { contentType: 'image/heic', ext: 'heic' };
  return { contentType: 'image/jpeg', ext: 'jpg' };
}

/**
 * Uploads a local image (file://, content://, blob: or data: URI) and returns
 * its public URL. `folder` groups files, e.g. `${companyId}/projects/${projectId}`.
 * Already-remote URLs (http/https) are returned unchanged.
 */
export async function uploadImage(localUri: string, folder: string): Promise<{ url: string; key: string }> {
  if (!isSupabaseConfigured || /^https?:\/\//i.test(localUri)) {
    return { url: localUri, key: localUri };
  }

  const { contentType, ext } = guessContentType(localUri);
  const key = `${folder}/${uuid()}.${ext}`;

  let body: Blob | FormData;
  if (Platform.OS === 'web') {
    body = await (await fetch(localUri)).blob();
  } else {
    // React Native uploads local files most reliably as multipart form data.
    const form = new FormData();
    form.append('file', { uri: localUri, name: key.split('/').pop(), type: contentType } as unknown as Blob);
    body = form;
  }

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(key, body, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, key };
}
