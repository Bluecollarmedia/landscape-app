/**
 * Compresses a photo or video on the phone before it is uploaded (rules in mediaPlan.ts).
 *
 * Photos use expo-image-manipulator (already in the app): resized so the long side is at most 1600 px, saved as JPEG at 50% quality.
 * The picker's own EXIF rotation is applied by the manipulator, so the stored photo is upright and keeps its aspect ratio.
 *
 * Videos need a native transcoder. The app does not include one yet: react-native-compressor must be added and the app rebuilt
 * (needs the owner's approval). Until then a video fails with a clear message and the person chooses Retry or "Upload original"; it is
 * never skipped quietly and never uploaded uncompressed without that choice. Once the library is present this adapter uses it with
 * a 480p cap and bitrate from planVideo().
 */
import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import { CompressionError, type MediaJob } from './mediaQueue';
import { planImage, planVideo, formatBytes, type ImagePlan } from './mediaPlan';

export const OUT_MARK = '/media-queue/out/';
/** A file this module already produced. */
export const isPrepared = (uri: string) => uri.includes(OUT_MARK);

function outFile(ext: string): File {
  const dir = new Directory(Paths.document, 'media-queue', 'out');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return new File(dir, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
}

const sizeOf = (uri: string): number | undefined => {
  try { return new File(uri).size ?? undefined; } catch { return undefined; }
};

export interface Prepared { uri: string; bytes?: number; width?: number; height?: number; mimeType: string }

export async function prepareImage(job: MediaJob): Promise<Prepared> {
  const bytesIn = job.bytesIn ?? sizeOf(job.sourceUri);
  const first = planImage({ width: job.width, height: job.height, bytes: bytesIn, mimeType: job.mimeType, alreadyPrepared: isPrepared(job.sourceUri) });
  if (first.action === 'skip') return { uri: job.sourceUri, bytes: bytesIn, width: job.width, height: job.height, mimeType: job.mimeType ?? 'image/jpeg' };
  try {
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    let plan: ImagePlan = first;
    let ctx = ImageManipulator.manipulate(job.sourceUri);
    if (!job.width || !job.height) {
      // The picker did not tell us the size: read it, then decide.
      const probe = await ctx.renderAsync();
      plan = planImage({ width: probe.width, height: probe.height, bytes: bytesIn, mimeType: job.mimeType });
      ctx = ImageManipulator.manipulate(job.sourceUri);
      if (plan.action === 'skip') return { uri: job.sourceUri, bytes: bytesIn, width: probe.width, height: probe.height, mimeType: job.mimeType ?? 'image/jpeg' };
    }
    if (plan.action === 'compress' && plan.resize) {
      // Only the long side is given, so the other follows and the ratio is kept exactly.
      ctx = plan.width >= plan.height ? ctx.resize({ width: plan.width }) : ctx.resize({ height: plan.height });
    }
    const ref = await ctx.renderAsync();
    const saved = await ref.saveAsync({ compress: plan.action === 'compress' ? plan.quality : 0.5, format: SaveFormat.JPEG });
    let uri = saved.uri;
    if (Platform.OS !== 'web') {
      const dest = outFile('jpg');
      new File(saved.uri).copy(dest);
      try { new File(saved.uri).delete(); } catch { /* cache file; harmless */ }
      uri = dest.uri;
    }
    const bytes = Platform.OS === 'web' ? undefined : sizeOf(uri);
    // A "compressed" file that came out BIGGER than a small original is not an improvement: keep the original in that case.
    if (bytes !== undefined && bytesIn !== undefined && bytes >= bytesIn && !(plan.action === 'compress' && plan.resize)) {
      try { new File(uri).delete(); } catch { /* ignore */ }
      return { uri: job.sourceUri, bytes: bytesIn, width: job.width, height: job.height, mimeType: job.mimeType ?? 'image/jpeg' };
    }
    return { uri, bytes, width: saved.width, height: saved.height, mimeType: 'image/jpeg' };
  } catch (err) {
    throw new CompressionError(`The photo couldn't be prepared (${(err as Error)?.message ?? 'unknown error'}).`);
  }
}

export async function prepareVideo(job: MediaJob): Promise<Prepared> {
  if (Platform.OS === 'web') throw new CompressionError('Video compression is not available in the web version. You can upload the original instead.');
  let compressor: { Video: { compress: (uri: string, opts: Record<string, unknown>, onProgress?: (p: number) => void) => Promise<string> } } | undefined;
  try { compressor = require('react-native-compressor'); } catch { compressor = undefined; }
  if (!compressor?.Video) {
    throw new CompressionError('Video compression is not part of this version of the app yet, so this video was not uploaded. You can upload the original (larger) or try again after the app is updated.');
  }
  const plan = planVideo({ width: job.width ?? VIDEO_FALLBACK, height: job.height ?? VIDEO_FALLBACK });
  try {
    // maxSize is the longest side: 854 keeps landscape at 854x480 and portrait at 480x854, aspect ratio unchanged.
    const uri = await compressor.Video.compress(job.sourceUri, { compressionMethod: 'manual', maxSize: Math.max(plan.width, plan.height), bitrate: plan.bitrate });
    return { uri, bytes: sizeOf(uri), width: plan.width, height: plan.height, mimeType: 'video/mp4' };
  } catch (err) {
    throw new CompressionError(`The video couldn't be compressed (${(err as Error)?.message ?? 'unknown error'}).`);
  }
}

// If the picker did not report the video's size, plan for a 1080p source (the result only sets maxSize, which never enlarges).
const VIDEO_FALLBACK = 1920;

export const describeSaving = (inBytes?: number, outBytes?: number) =>
  inBytes && outBytes ? `${formatBytes(inBytes)} → ${formatBytes(outBytes)}` : '';
