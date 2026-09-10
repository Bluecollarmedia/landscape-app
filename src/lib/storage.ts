/**
 * Storage Client
 *
 * Handles file uploads through server-authorized presigned URLs.
 * R2 credentials are NEVER in this file — they live in Edge Functions only.
 *
 * Flow:
 * 1. Client requests presigned URL from Edge Function (with auth token)
 * 2. Edge Function validates: auth, file type, size, quota, rate limit
 * 3. Edge Function returns presigned PUT URL
 * 4. Client uploads directly to R2 using the presigned URL
 * 5. Client confirms upload and records the file reference
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { logger } from './logger';
import type {
  UploadRequest,
  PresignedUploadResponse,
  StorageInfo,
  UploadPurpose,
} from '@/types/storage';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_DEFAULT, MAX_AVATAR_SIZE } from '@/types/storage';

export const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '';

// ── Client-side validation (before hitting the server) ────────────

export function validateFileLocally(
  contentType: string,
  size: number,
  purpose: UploadPurpose,
): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return {
      valid: false,
      error: 'This file type is not supported. Please use JPEG, PNG, or WebP images.',
    };
  }

  const maxSize = purpose === 'avatar' ? MAX_AVATAR_SIZE : MAX_FILE_SIZE_DEFAULT;
  if (size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `This file is too large. Maximum size is ${maxMB} MB.`,
    };
  }

  if (size === 0) {
    return { valid: false, error: 'The selected file is empty.' };
  }

  return { valid: true };
}

// ── Request presigned URL from Edge Function ──────────────────────

export async function requestUploadUrl(
  request: UploadRequest,
): Promise<PresignedUploadResponse> {
  if (!isSupabaseConfigured) {
    return mockPresignedUrl(request);
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new UploadError('You must be signed in to upload files.', 'auth');
  }

  const response = await supabase.functions.invoke('upload-url', {
    body: request,
  });

  if (response.error) {
    const msg = response.error.message || 'Upload request failed';
    logger.error('upload-url failed', { error: msg, purpose: request.purpose });

    if (msg.includes('quota')) throw new UploadError(msg, 'quota');
    if (msg.includes('rate limit')) throw new UploadError(msg, 'rate_limit');
    if (msg.includes('type not allowed')) throw new UploadError(msg, 'invalid_type');
    if (msg.includes('too large')) throw new UploadError(msg, 'too_large');
    throw new UploadError(msg, 'server');
  }

  return response.data as PresignedUploadResponse;
}

// ── Upload file to presigned URL ──────────────────────────────────

export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: Blob | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!response.ok) {
    throw new UploadError(
      'Upload failed. Please check your connection and try again.',
      'network',
    );
  }
}

// ── Full upload flow (validate → presign → upload) ────────────────

export async function uploadFile(
  file: Blob,
  request: Omit<UploadRequest, 'size'>,
  onProgress?: (percent: number) => void,
): Promise<{ fileKey: string; publicUrl: string }> {
  onProgress?.(0);

  // Client-side validation first
  const validation = validateFileLocally(
    request.contentType,
    file.size,
    request.purpose,
  );
  if (!validation.valid) {
    throw new UploadError(validation.error!, 'validation');
  }

  onProgress?.(10);

  // Get presigned URL from server
  const presigned = await requestUploadUrl({
    ...request,
    size: file.size,
  });

  if (presigned.duplicate) {
    onProgress?.(100);
    return { fileKey: presigned.fileKey, publicUrl: presigned.publicUrl };
  }

  onProgress?.(30);

  // Upload to R2
  await uploadToPresignedUrl(presigned.uploadUrl, file, request.contentType);

  onProgress?.(100);

  logger.info('File uploaded', {
    purpose: request.purpose,
    size: file.size,
    fileKey: presigned.fileKey,
  });

  return { fileKey: presigned.fileKey, publicUrl: presigned.publicUrl };
}

// ── Delete media ──────────────────────────────────────────────────

export async function deleteMedia(
  fileKey: string,
  source: 'project_photos' | 'worker_photos' | 'avatar',
): Promise<void> {
  if (!isSupabaseConfigured) {
    logger.info('Mock delete', { fileKey, source });
    return;
  }

  const response = await supabase.functions.invoke('delete-media', {
    body: { fileKey, source },
  });

  if (response.error) {
    throw new UploadError('Failed to delete file. Please try again.', 'server');
  }
}

// ── Storage usage ─────────────────────────────────────────────────

export async function getStorageInfo(): Promise<StorageInfo> {
  if (!isSupabaseConfigured) {
    return mockStorageInfo();
  }

  const response = await supabase.functions.invoke('storage-usage', {
    method: 'GET',
  });

  if (response.error) {
    throw new UploadError('Failed to load storage info.', 'server');
  }

  return response.data as StorageInfo;
}

export async function updateStorageSettings(
  settings: Partial<{
    max_storage_bytes: number;
    max_file_size_bytes: number;
    rate_limit_uploads_per_minute: number;
    rate_limit_uploads_per_hour: number;
  }>,
): Promise<void> {
  if (!isSupabaseConfigured) {
    logger.info('Mock settings update', settings);
    return;
  }

  const response = await supabase.functions.invoke('storage-usage', {
    body: settings,
  });

  if (response.error) {
    throw new UploadError('Failed to update storage settings.', 'server');
  }
}

// ── Public URL builder ────────────────────────────────────────────

export function getPublicUrl(fileKey: string): string {
  if (!R2_PUBLIC_URL) return fileKey;
  return `${R2_PUBLIC_URL}/${fileKey}`;
}

// ── Idempotency key generator ─────────────────────────────────────

export function generateIdempotencyKey(
  userId: string,
  fileName: string,
  size: number,
): string {
  return `${userId}-${fileName}-${size}-${Math.floor(Date.now() / 60000)}`;
}

// ── Error class ───────────────────────────────────────────────────

export type UploadErrorCode =
  | 'auth'
  | 'validation'
  | 'quota'
  | 'rate_limit'
  | 'invalid_type'
  | 'too_large'
  | 'network'
  | 'server';

export class UploadError extends Error {
  code: UploadErrorCode;
  constructor(message: string, code: UploadErrorCode) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
  }
}

// ── Mock implementations for dev mode ─────────────────────────────

function mockPresignedUrl(request: UploadRequest): PresignedUploadResponse {
  const timestamp = Date.now();
  const fileKey = `${request.purpose}/${request.entityId ?? 'mock'}/${timestamp}-${request.fileName}`;
  return {
    uploadUrl: `https://mock-r2.local/upload/${fileKey}`,
    fileKey,
    publicUrl: `https://placehold.co/800x600/7CB342/FFFFFF?text=${encodeURIComponent(request.fileName)}`,
    expiresAt: timestamp + 300_000,
  };
}

function mockStorageInfo(): StorageInfo {
  return {
    usage: {
      totalBytes: 157_286_400,
      fileCount: 42,
      photoCount: 38,
      avatarCount: 3,
      documentCount: 1,
      percentUsed: 3,
    },
    settings: {
      maxStorageBytes: 5_368_709_120,
      maxFileSizeBytes: 10_485_760,
      rateLimitPerMinute: 10,
      rateLimitPerHour: 100,
    },
  };
}
