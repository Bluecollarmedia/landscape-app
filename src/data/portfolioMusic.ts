/**
 * The owner's own music for a post (phone only): pick an audio file from the phone, read how long it is, and upload it. The whole track is saved
 * once together with the part chosen (start and end); the app plays just that part. Nothing here talks to a music service.
 */
import * as DocumentPicker from 'expo-document-picker';
import { uploadImage } from '@/lib/media';
import { portfolioFolder } from '@/lib/portfolioMedia';
import { MAX_TRACK_MB, isUsableTrack } from '@/lib/portfolio';

export interface PickedTrack { uri: string; fileName: string; mimeType: string | null; sizeBytes: number | null }

/** Opens the phone's Files picker for an audio file. Returns null when cancelled, or an error in plain words. */
export async function pickTrack(): Promise<{ ok: true; track: PickedTrack } | { ok: false; error: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if (!isUsableTrack(a.name, a.mimeType)) return { ok: false, error: 'Choose an audio file (MP3, M4A, AAC or WAV).' };
  if (a.size && a.size > MAX_TRACK_MB * 1024 * 1024) return { ok: false, error: `That track is bigger than ${MAX_TRACK_MB} MB. Choose a smaller one.` };
  return { ok: true, track: { uri: a.uri, fileName: a.name, mimeType: a.mimeType ?? null, sizeBytes: a.size ?? null } };
}

/** How long a track is, in seconds (null when the phone cannot read it in a few seconds). */
export async function readTrackDuration(uri: string): Promise<number | null> {
  try {
    const { createVideoPlayer } = require('expo-video') as typeof import('expo-video');
    const player = createVideoPlayer(uri);
    return await new Promise<number | null>((resolve) => {
      let done = false;
      const finish = (v: number | null) => { if (done) return; done = true; sub.remove(); clearTimeout(timer); try { player.release(); } catch { /* already gone */ } resolve(v); };
      const sub = player.addListener('sourceLoad', ({ duration }) => finish(duration > 0 ? duration : null));
      const timer = setTimeout(() => finish(player.duration > 0 ? player.duration : null), 6000);
    });
  } catch {
    return null;
  }
}

/** Sends the track as it is. */
export async function uploadTrack(track: PickedTrack, companyId: string): Promise<{ url: string; key: string }> {
  return uploadImage(track.uri, portfolioFolder(companyId, 'music'), track.mimeType ?? undefined, undefined, { raw: true });
}
