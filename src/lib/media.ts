/**
 * Photo and video uploads.
 *
 * Files go to Cloudflare R2 (through the `media` Edge Function, which hands out
 * a short upload link) once EXPO_PUBLIC_R2_PUBLIC_URL is set in the build.
 * Until then they fall back to the public Supabase "media" bucket so the app
 * keeps working during the move. Old Supabase files keep their links.
 *
 * In demo mode (no Supabase configured) the local file URI is returned as-is.
 */

import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { uuid } from './ids';
import { explainUploadError, SIGNED_OUT_UPLOAD_MESSAGE } from './uploadErrors';

export const MEDIA_BUCKET = 'media';

/** True once the build knows the R2 public address. */
export const r2Enabled = !!process.env.EXPO_PUBLIC_R2_PUBLIC_URL;

function guessContentType(uri: string, mimeType?: string): { contentType: string; ext: string } {
  const lower = uri.split('?')[0].toLowerCase();
  const mime = (mimeType ?? '').toLowerCase();
  if (mime === 'video/quicktime' || lower.endsWith('.mov')) return { contentType: 'video/quicktime', ext: 'mov' };
  if (mime.startsWith('video/') || lower.endsWith('.mp4') || lower.endsWith('.m4v')) return { contentType: 'video/mp4', ext: 'mp4' };
  if (mime === 'image/png' || lower.endsWith('.png')) return { contentType: 'image/png', ext: 'png' };
  if (mime === 'image/webp' || lower.endsWith('.webp')) return { contentType: 'image/webp', ext: 'webp' };
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return { contentType: 'image/heic', ext: 'heic' };
  return { contentType: 'image/jpeg', ext: 'jpg' };
}

/**
 * Uploads a local image or video (file://, content://, blob: or data: URI) and returns
 * its public URL. `folder` groups files, e.g. `${companyId}/projects/${projectId}`.
 * Already-remote URLs (http/https) are returned unchanged.
 */
export async function uploadImage(localUri: string, folder: string, mimeType?: string): Promise<{ url: string; key: string }> {
  if (!isSupabaseConfigured || /^https?:\/\//i.test(localUri)) {
    return { url: localUri, key: localUri };
  }

  const { contentType, ext } = guessContentType(localUri, mimeType);
  await requireSession();
  try {
    if (r2Enabled) return await uploadToR2(localUri, folder, contentType);

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
    if (error) throw error;

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(key);
    return { url: data.publicUrl, key };
  } catch (err) {
    throw new Error(`Upload failed: ${explainUploadError(err).replace(/^Upload failed:?\s*/i, '')}`);
  }
}

/** Uploads need a signed-in session; without one the server refuses with a confusing permission error. */
export async function requireSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) throw new Error(SIGNED_OUT_UPLOAD_MESSAGE);
}

async function uploadToR2(localUri: string, folder: string, contentType: string): Promise<{ url: string; key: string }> {
  const blob = await (await fetch(localUri)).blob();
  const { data, error } = await supabase.functions.invoke('media', {
    body: { action: 'put', folder, contentType, size: blob.size },
  });
  if (error || !data?.uploadUrl) throw new Error(error?.message ?? data?.error ?? 'no upload link');

  const res = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!res.ok) throw new Error(`The storage server answered ${res.status}`);
  return { url: data.publicUrl as string, key: data.key as string };
}

/**
 * Removes an uploaded file by its key. Files can be in R2 (new) or the old
 * Supabase bucket, so both are asked; one of them simply has nothing to delete.
 */
export async function removeMedia(key: string): Promise<void> {
  if (!isSupabaseConfigured || /^https?:\/\//i.test(key)) return;
  if (r2Enabled) {
    const { error } = await supabase.functions.invoke('media', { body: { action: 'delete', key } });
    if (error) console.warn('[media] R2 delete failed', error.message);
  }
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([key]);
  if (error) console.warn('[media] cleanup failed', error.message);
}
