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
      // The LEGACY file API, like the picker copy: on some phones the new File API cannot see files the image tools just wrote, so a copy made
      // with it can be missing (the upload then said "the file is gone"). Whatever happens, never hand on an address that is not a real file.
      const legacy = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
      const dest = outFile('jpg');
      try {
        await legacy.copyAsync({ from: saved.uri, to: dest.uri });
        const info = await legacy.getInfoAsync(dest.uri);
        if (info.exists && (info.size ?? 0) > 0) {
          uri = dest.uri;
          try { await legacy.deleteAsync(saved.uri, { idempotent: true }); } catch { /* cache file; harmless */ }
        }
      } catch { /* keep the prepared file where it is */ }
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

/** Videos are never compressed: they go up exactly as they were recorded or picked. */
export async function prepareVideo(job: MediaJob): Promise<Prepared> {
  return { uri: job.sourceUri, bytes: job.bytesIn ?? sizeOf(job.sourceUri), width: job.width, height: job.height, mimeType: job.mimeType ?? 'video/mp4' };
}

// If the picker did not report the video's size, plan for a 1080p source (the result only sets maxSize, which never enlarges).
const VIDEO_FALLBACK = 1920;

export const describeSaving = (inBytes?: number, outBytes?: number) =>
  inBytes && outBytes ? `${formatBytes(inBytes)} → ${formatBytes(outBytes)}` : '';
