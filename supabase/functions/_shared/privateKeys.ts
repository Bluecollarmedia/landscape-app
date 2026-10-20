/**
 * Which stored files are PRIVATE. Private files live in their own R2 bucket that has no public address; they are opened only through
 * short-lived signed links that the `media` function hands out after checking who is asking. Everything else stays in the public bucket.
 *
 *   ids/{personId}/...                 ID photos
 *   {companyId}/maintenance/...        maintenance stop photos (internal unless the owner shares them)
 *   {companyId}/reference/...          Snow property reference photos/videos
 *   {companyId}/completion/...         Snow completion photos/videos
 *
 * The app has the same rule in src/lib/privateMedia.ts (a check keeps the two identical).
 */
const PRIVATE_FOLDERS = new Set(['maintenance', 'reference', 'completion']);

export function isPrivateKey(key: string): boolean {
  const parts = key.split('/');
  if (parts[0] === 'ids') return true;
  return parts.length >= 3 && PRIVATE_FOLDERS.has(parts[1]);
}
