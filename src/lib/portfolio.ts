/**
 * "Our Work" (the portfolio): everything that decides what visitors see and how the owner's choices behave, as pure functions (no React, no
 * network), so it is tested without a phone. The data comes from update 115 (public_portfolio for visitors, the portfolio_* tables for the owner).
 */

export type MediaKind = 'photo' | 'video';
export type PostKind = 'post' | 'video';

export interface PortfolioMedia {
  id: string;
  kind: MediaKind;
  url: string;
  thumb_url: string | null;
  duration_s: number | null;
  position: number;
}

export interface PortfolioPost {
  id: string;
  kind: PostKind;
  caption: string;
  town: string;
  taken_on: string;
  tags: string[];
  show_in_grid: boolean;
  posted_at: string;
  cover_url: string | null;
  /** A small (about 360 px) copy of the cover for the grid, made when the owner saves the post. */
  cover_thumb_url?: string | null;
  music_url: string | null;
  music_title: string | null;
  music_start_s: number | null;
  music_end_s: number | null;
  music_fade: boolean;
  keep_video_sound: boolean;
  media: PortfolioMedia[];
}

export interface PortfolioHighlight {
  id: string;
  name: string;
  cover_url: string | null;
  mode: 'tag' | 'manual';
  tag: string | null;
  position: number;
  post_ids: string[];
}

export interface PortfolioProfile { handle: string; bio: string; website: string }

export interface PublicPortfolio {
  enabled: boolean;
  profile: PortfolioProfile;
  posts: PortfolioPost[];
  highlights: PortfolioHighlight[];
}

/** The tags an owner can put on a post (the same words as the circles at the top). */
export const TAG_CHOICES = ['Pavers', 'Turf', 'Lighting', 'Planting', 'Commercial', 'Snow'] as const;

export const MAX_VIDEO_S = 60;
export const MIN_CLIP_S = 5;
export const MAX_CLIP_S = 60;
export const CAPTION_MAX = 2200;

/** "0:24", "1:05". Nothing (empty) when there is no length. */
export function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const sortedMedia = (post: Pick<PortfolioPost, 'media'>): PortfolioMedia[] =>
  [...post.media].sort((a, b) => a.position - b.position);

const newestFirst = (a: PortfolioPost, b: PortfolioPost) => Date.parse(b.posted_at) - Date.parse(a.posted_at);

/** The picture the grid shows for a post: the owner's chosen cover, else the first photo, else the first video's frame. */
export function postCoverUrl(post: PortfolioPost): string | null {
  if (post.cover_url) return post.cover_url;
  const media = sortedMedia(post);
  return media.find((m) => m.kind === 'photo')?.url ?? media.find((m) => m.kind === 'video')?.thumb_url ?? null;
}

/**
 * The SMALL picture for a grid tile (so a screen of tiles is light to load): the small copy of the cover, else the first photo's small copy,
 * else the full-size picture as a last resort, else the video's frame.
 */
export function postGridUrl(post: PortfolioPost): string | null {
  if (post.cover_thumb_url) return post.cover_thumb_url;
  if (post.cover_url) return post.cover_url;
  const media = sortedMedia(post);
  const photo = media.find((m) => m.kind === 'photo');
  return photo ? photo.thumb_url ?? photo.url : media.find((m) => m.kind === 'video')?.thumb_url ?? null;
}

/** How many grid tiles are drawn at first, and how many more each time the person scrolls near the end. */
export const GRID_PAGE = 30;
export const growCount = (count: number, total: number): number => Math.min(total, count + GRID_PAGE);

/**
 * Which pictures in a swipe row may load: only the one on screen. (The next one is fetched quietly afterwards, one at a time, by the screen.)
 * A post with 10 photos therefore asks for 1 picture when it opens, not 10.
 */
export const shouldLoadSlide = (slideIndex: number, currentIndex: number): boolean => slideIndex === currentIndex;

export const hasVideo = (post: PortfolioPost): boolean => post.media.some((m) => m.kind === 'video');

/** The posts in the photo grid: every project post, and a video post only when the owner chose to show it there. Newest first. */
export function gridPosts(posts: PortfolioPost[]): PortfolioPost[] {
  return posts.filter((p) => p.media.length > 0 && (p.kind === 'post' || p.show_in_grid)).sort(newestFirst);
}

/** One entry per video, for the Videos tab (a post with a video in it shows that video; its length is shown on the tile). Newest first. */
export interface VideoEntry { post: PortfolioPost; media: PortfolioMedia }
export function videoEntries(posts: PortfolioPost[]): VideoEntry[] {
  const out: VideoEntry[] = [];
  for (const post of [...posts].sort(newestFirst)) {
    for (const media of sortedMedia(post)) if (media.kind === 'video') out.push({ post, media });
  }
  return out;
}

/** The three numbers under the profile picture. Counted from what is shown, never typed in by hand. */
export function portfolioCounts(posts: PortfolioPost[]): { projects: number; photos: number; services: number } {
  const tags = new Set<string>();
  let photos = 0;
  for (const p of posts) {
    for (const t of p.tags) tags.add(t);
    photos += p.media.filter((m) => m.kind === 'photo').length;
  }
  return { projects: posts.filter((p) => p.kind === 'post').length, photos, services: tags.size };
}

/** The posts inside a highlight: automatic ones follow a tag (new posts join on their own), manual ones are the owner's picks in their order. */
export function postsForHighlight(h: PortfolioHighlight, posts: PortfolioPost[]): PortfolioPost[] {
  if (h.mode === 'tag') return h.tag ? posts.filter((p) => p.tags.includes(h.tag as string)).sort(newestFirst) : [];
  const byId = new Map(posts.map((p) => [p.id, p]));
  return h.post_ids.map((id) => byId.get(id)).filter((p): p is PortfolioPost => !!p);
}

/** The circle's picture: the owner's chosen one, else the cover of the first post inside it. */
export function highlightCoverUrl(h: PortfolioHighlight, posts: PortfolioPost[]): string | null {
  if (h.cover_url) return h.cover_url;
  const first = postsForHighlight(h, posts)[0];
  return first ? postGridUrl(first) : null;
}

/** A highlight with nothing in it is not shown to visitors. */
export const visibleHighlights = (hs: PortfolioHighlight[], posts: PortfolioPost[]): PortfolioHighlight[] =>
  [...hs].sort((a, b) => a.position - b.position).filter((h) => postsForHighlight(h, posts).length > 0);

// ── Music: the part of the track that plays ─────────────────────────────────────────────────────────────────────────────────────────

export interface Clip { startS: number; endS: number }

/**
 * Keeps a chosen part of a track sensible: inside the track, between 5 and 60 seconds long (a track shorter than 5 seconds plays whole).
 * When the part is too long the end is pulled in; too short, the end is pushed out (or the start pulled back at the end of the track).
 */
export function normalizeClip(startS: number, endS: number, trackS: number): Clip {
  const track = Math.max(0, Number.isFinite(trackS) ? trackS : 0);
  if (track <= MIN_CLIP_S) return { startS: 0, endS: track };
  let start = Math.min(Math.max(0, Number.isFinite(startS) ? startS : 0), track - MIN_CLIP_S);
  let end = Number.isFinite(endS) ? endS : start + MAX_CLIP_S;
  end = Math.min(end, track, start + MAX_CLIP_S);
  if (end - start < MIN_CLIP_S) end = Math.min(track, start + MIN_CLIP_S);
  if (end - start < MIN_CLIP_S) start = Math.max(0, end - MIN_CLIP_S);
  return { startS: round1(start), endS: round1(end) };
}
const round1 = (n: number) => Math.round(n * 10) / 10;

export const clipLengthS = (c: Clip): number => Math.max(0, c.endS - c.startS);

/** While a post is open the part loops: once playback reaches the end of the part it jumps back to the start. */
export function nextLoopPosition(currentS: number, c: Clip): number | null {
  return currentS >= c.endS || currentS < c.startS - 0.5 ? c.startS : null;
}

/** The volume at a moment of the part, with the fade-out (the last 2 seconds) when it is on. 1 = full. */
export function clipVolume(currentS: number, c: Clip, fade: boolean): number {
  if (!fade) return 1;
  const left = c.endS - currentS;
  return left >= 2 ? 1 : Math.max(0, left / 2);
}

// ── The scrub bar ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const fractionOf = (timeS: number, durationS: number): number =>
  durationS > 0 && Number.isFinite(timeS) ? Math.min(1, Math.max(0, timeS / durationS)) : 0;

export const timeAtFraction = (fraction: number, durationS: number): number =>
  durationS > 0 ? Math.min(durationS, Math.max(0, fraction * durationS)) : 0;

/** The bar is thin at rest and thick while a finger is on it (easier to aim); the numbers are in points. */
export const SCRUB_BAR_HEIGHT = { resting: 3, scrubbing: 12 } as const;

// ── Owner: what a post needs before it can be saved ──────────────────────────────────────────────────────────────────────────────

export interface PostDraft {
  kind: PostKind;
  caption: string;
  town: string;
  tags: string[];
  media: { kind: MediaKind; duration_s: number | null }[];
  music?: { url: string; startS: number; endS: number } | null;
}

/** The first thing wrong with a post, in plain words, or null when it can be saved. */
export function postProblem(d: PostDraft): string | null {
  if (d.media.length < 1) return d.kind === 'video' ? 'Choose a video.' : 'Add at least one photo or video.';
  if (d.kind === 'video' && (d.media.length !== 1 || d.media[0].kind !== 'video')) return 'A video post holds exactly one video.';
  if (d.media.some((m) => m.kind === 'video' && (m.duration_s == null || m.duration_s > MAX_VIDEO_S))) return `Videos can be up to ${MAX_VIDEO_S} seconds.`;
  if (d.caption.length > CAPTION_MAX) return 'The caption is too long.';
  if (d.town.length > 80) return 'The town is too long.';
  if (d.tags.length > 8 || d.tags.some((t) => !(TAG_CHOICES as readonly string[]).includes(t))) return 'Choose tags from the list.';
  if (d.music && !(d.music.endS > d.music.startS)) return 'Choose the part of the music that plays.';
  return null;
}

/** Moves one item in a list (drag to reorder). Out-of-range moves leave the list as it was. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** The pre-filled note on the Request form when someone taps "Want something like this?". */
export function requestNoteFor(post: Pick<PortfolioPost, 'town' | 'caption' | 'tags'>): { services: string[]; note: string } {
  const map: Record<string, string> = {
    Pavers: 'Pavers, Patios & Walkways', Turf: 'Turf & Sod Installation', Lighting: 'Lighting & Planting', Planting: 'Lighting & Planting',
    Commercial: 'Commercial Maintenance', Snow: 'Snow & Storm Response',
  };
  const services = [...new Set(post.tags.map((t) => map[t]).filter(Boolean))];
  const where = post.town ? ` in ${post.town}` : '';
  return { services, note: `Something like your project${where}.` };
}
