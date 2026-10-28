/**
 * Sends the owner's pictures and videos for Our Work to the public bucket (phone only). Photos: saved high quality (long side up to 2400 px) plus a
 * small square copy for the grid. Videos: uploaded exactly as they are, plus a still frame for the grid. Nothing here compresses a video.
 */
import { uploadImage } from '@/lib/media';
import {
  FULL_LONG_SIDE, FULL_QUALITY, THUMB_QUALITY, THUMB_SIZE, fitLongSide, portfolioFolder, squareCrop, thumbFolder, type PortfolioFolder,
} from '@/lib/portfolioMedia';

export interface UploadedPhoto { url: string; key: string; thumbUrl: string; thumbKey: string; width: number; height: number }
export interface UploadedVideo { url: string; key: string; thumbUrl: string | null; thumbKey: string | null }

/** A photo: one high-quality copy and one small square copy. */
export async function uploadPortfolioPhoto(localUri: string, companyId: string, kind: PortfolioFolder = 'posts'): Promise<UploadedPhoto> {
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const probe = await ImageManipulator.manipulate(localUri).renderAsync();
  const fit = fitLongSide(probe.width, probe.height, FULL_LONG_SIDE);
  let ctx = ImageManipulator.manipulate(localUri);
  if (fit.width < probe.width) ctx = ctx.resize({ width: fit.width });
  const full = await (await ctx.renderAsync()).saveAsync({ compress: FULL_QUALITY, format: SaveFormat.JPEG });

  // The small copy is cut from the saved (upright) picture, so the crop always matches what people see.
  const sq = squareCrop(full.width, full.height);
  const small = await (await ImageManipulator.manipulate(full.uri)
    .crop({ originX: sq.originX, originY: sq.originY, width: sq.size, height: sq.size })
    .resize({ width: THUMB_SIZE })
    .renderAsync()).saveAsync({ compress: THUMB_QUALITY, format: SaveFormat.JPEG });

  const big = await uploadImage(full.uri, portfolioFolder(companyId, kind), 'image/jpeg', undefined, { raw: true });
  const thumb = await uploadImage(small.uri, thumbFolder(companyId, kind), 'image/jpeg', undefined, { raw: true });
  return { url: big.url, key: big.key, thumbUrl: thumb.url, thumbKey: thumb.key, width: full.width, height: full.height };
}

/** A video, as it is. The still frame for the grid is best effort: a video with no frame still posts (its tile just has no picture). */
export async function uploadPortfolioVideo(localUri: string, companyId: string, kind: PortfolioFolder = 'posts', frameAtS = 0.5): Promise<UploadedVideo> {
  const up = await uploadImage(localUri, portfolioFolder(companyId, kind), 'video/mp4', undefined, { raw: true });
  const frame = await videoFrameToFile(localUri, frameAtS);
  if (!frame) return { url: up.url, key: up.key, thumbUrl: null, thumbKey: null };
  try {
    const thumb = await uploadImage(frame, thumbFolder(companyId, kind), 'image/jpeg', undefined, { raw: true });
    return { url: up.url, key: up.key, thumbUrl: thumb.url, thumbKey: thumb.key };
  } catch {
    return { url: up.url, key: up.key, thumbUrl: null, thumbKey: null };
  }
}

/** One frame of a video, saved as a picture file (null when the phone cannot make it). */
export async function videoFrameToFile(videoUri: string, atS: number): Promise<string | null> {
  try {
    const { createVideoPlayer } = require('expo-video') as typeof import('expo-video');
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const player = createVideoPlayer(videoUri);
    try {
      const [frame] = await player.generateThumbnailsAsync(atS, { maxWidth: 1080 });
      if (!frame) return null;
      const saved = await (await ImageManipulator.manipulate(frame).renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      return saved.uri;
    } finally {
      player.release();
    }
  } catch {
    return null;
  }
}
