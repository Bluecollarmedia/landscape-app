/**
 * Stories, the owner's side (update 115): add a photo or video, share a project or video as a designed card, see what is up, take one down.
 * The owner and admins only (the database refuses everyone else). Every call returns a plain result and never throws.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uploadImage } from '@/lib/media';
import { db } from '@/data/store';
import { storyProblem, type PortfolioStory, type StoryDesign } from '@/lib/portfolioStories';
import type { PortfolioPost } from '@/lib/portfolio';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const SOMETHING_WRONG = "Couldn't reach the server. Check your connection and try again.";

/** The stories that are up right now (the owner sees them with their time left). */
export async function loadMyStories(): Promise<Result<PortfolioStory[]>> {
  if (!isSupabaseConfigured) return { ok: false, error: SOMETHING_WRONG };
  try {
    const { data, error } = await supabase.from('portfolio_stories').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true });
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, data: (data ?? []) as PortfolioStory[] };
  } catch {
    return { ok: false, error: SOMETHING_WRONG };
  }
}

/** The posts the owner can share (newest first), with their pictures. */
export async function loadPostsToShare(): Promise<Result<PortfolioPost[]>> {
  if (!isSupabaseConfigured) return { ok: false, error: SOMETHING_WRONG };
  try {
    const { data, error } = await supabase
      .from('portfolio_posts')
      .select('id, kind, caption, town, taken_on, tags, show_in_grid, posted_at, cover_url, cover_thumb_url, music_url, music_title, music_start_s, music_end_s, music_fade, keep_video_sound, media:portfolio_media(id, kind, url, thumb_url, duration_s, position)')
      .order('posted_at', { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, data: (data ?? []) as unknown as PortfolioPost[] };
  } catch {
    return { ok: false, error: SOMETHING_WRONG };
  }
}

/** Adds a photo or a video (up to 60 seconds) to the story. A video is shrunk to 480p first (the original goes up if that cannot be done). */
export async function addMediaStory(input: { kind: 'photo' | 'video'; localUri: string; mimeType?: string; durationS?: number | null }): Promise<Result<null>> {
  const bad = storyProblem({ kind: input.kind, mediaUrl: input.localUri, durationS: input.durationS ?? null });
  if (bad) return { ok: false, error: bad };
  const companyId = db.companyId;
  if (!companyId) return { ok: false, error: 'Sign in again.' };
  try {
    const { shrinkVideoUri } = require('@/lib/mediaCompress') as typeof import('@/lib/mediaCompress');
    const source = input.kind === 'video' ? await shrinkVideoUri(input.localUri) : input.localUri;
    const up = await uploadImage(source, `${companyId}/portfolio/stories`, input.mimeType);
    const { error } = await supabase.from('portfolio_stories').insert({
      company_id: companyId, kind: input.kind, media_url: up.url, duration_s: input.kind === 'video' ? input.durationS : null, created_by: db.personId ?? null,
    });
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : SOMETHING_WRONG };
  }
}

/** Shares a project or video to the story as a card with the owner's design; tapping the card opens it. */
export async function addShareStory(input: { postId: string; mediaId?: string | null; design: StoryDesign }): Promise<Result<null>> {
  const bad = storyProblem({ kind: 'share', postId: input.postId, design: input.design });
  if (bad) return { ok: false, error: bad };
  const companyId = db.companyId;
  if (!companyId) return { ok: false, error: 'Sign in again.' };
  try {
    const { error } = await supabase.from('portfolio_stories').insert({
      company_id: companyId, kind: 'share', post_id: input.postId, media_id: input.mediaId ?? null, design: input.design, created_by: db.personId ?? null,
    });
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: SOMETHING_WRONG };
  }
}

export async function deleteStory(id: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.from('portfolio_stories').delete().eq('id', id);
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: SOMETHING_WRONG };
  }
}

/** The server's wording for "the update has not been run yet" is turned into something a person can act on. */
function friendly(message: string): string {
  return /relation .* does not exist|schema cache|could not find/i.test(message) ? 'Our Work is not installed on the database yet.' : message;
}
