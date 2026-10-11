import type { Project } from '@/types/project';
import { db } from '@/data/store';

/**
 * A project's picture: the owner's own cover photo when one was added,
 * otherwise a stock property photo picked deterministically per project id
 * (same project always shows the same photo).
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

export function getProjectImageUri(project: Pick<Project, 'id' | 'coverPhotoUrl'>, width = 600): string {
  if (project.coverPhotoUrl) return project.coverPhotoUrl;
  const id = FALLBACK_PROJECT_PHOTO_IDS[hashCode(project.id) % FALLBACK_PROJECT_PHOTO_IDS.length];
  return `https://images.unsplash.com/${id}?w=${width}&q=80`;
}

/** Projects looked up by id, for screens that only have an assignment's project id. */
export function getProjectImageUriById(projectId: string | undefined, width = 600): string {
  const project = projectId ? db.projects.find((p) => p.id === projectId) : undefined;
  return getProjectImageUri(project ?? { id: projectId ?? 'default' }, width);
}

const DEFAULT_DASHBOARD_PHOTO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80';

/** The dashboard header photo: the company's own, or a stock photo. */
export function getCompanyImageUri(): string {
  return db.company?.coverPhotoUrl || DEFAULT_DASHBOARD_PHOTO;
}
