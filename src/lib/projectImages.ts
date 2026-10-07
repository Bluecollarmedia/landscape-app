import type { Project } from '@/types/project';

/**
 * Temporary stock property photos, picked deterministically per project id
 * (same project always shows the same photo). Swap the body of
 * getProjectImageUri for project.coverImageUrl once real project cover
 * images exist (Supabase/R2) — callers don't need to change.
 */
const FALLBACK_PROJECT_PHOTO_IDS = [
  'photo-1613977257363-707ba9348227',
  'photo-1558904541-efa843a96f01',
  'photo-1600607687939-ce8a6c25118c',
  'photo-1571939228382-b2f2b585ce15',
  'photo-1600585154340-be6161a56a0c',
];

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getProjectImageUri(project: Project, width = 600): string {
  const id = FALLBACK_PROJECT_PHOTO_IDS[hashCode(project.id) % FALLBACK_PROJECT_PHOTO_IDS.length];
  return `https://images.unsplash.com/${id}?w=${width}&q=80`;
}
