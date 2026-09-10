export type UploadPurpose = 'project-photo' | 'worker-photo' | 'avatar' | 'before-after';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export interface UploadRequest {
  fileName: string;
  contentType: string;
  size: number;
  purpose: UploadPurpose;
  entityId?: string;
  idempotencyKey?: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresAt: number;
  duplicate?: boolean;
}

export interface UploadProgress {
  id: string;
  fileName: string;
  status: UploadStatus;
  progress: number;
  fileKey?: string;
  publicUrl?: string;
  error?: string;
}

export interface StorageUsage {
  totalBytes: number;
  fileCount: number;
  photoCount: number;
  avatarCount: number;
  documentCount: number;
  percentUsed: number;
}

export interface StorageSettings {
  maxStorageBytes: number;
  maxFileSizeBytes: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
}

export interface StorageInfo {
  usage: StorageUsage;
  settings: StorageSettings;
}

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const MAX_FILE_SIZE_DEFAULT = 10 * 1024 * 1024;
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
}
