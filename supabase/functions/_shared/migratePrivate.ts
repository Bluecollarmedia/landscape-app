/**
 * Moves existing private files (maintenance photos, Snow media, ID photos) from the public bucket to the private one.
 *
 * Safe by construction: a file is COPIED first, the copy is checked (same size as the original), and only then, and only when the run
 * is told to delete, is the original removed. Running it again is harmless (a file already moved is skipped). Nothing is ever removed
 * without a verified copy. Pure logic with injected dependencies, so it is tested without Deno, a network or real storage.
 */
import { isPrivateKey } from './privateKeys.ts';

export interface MigrateDeps {
  /** One page of keys from the PUBLIC bucket (and where to continue, or undefined at the end). */
  listPublic: (token?: string) => Promise<{ keys: string[]; next?: string }>;
  /** Size of the object in the private bucket, or undefined if it is not there. */
  sizePrivate: (key: string) => Promise<number | undefined>;
  /** Size of the object in the public bucket, or undefined if it is not there. */
  sizePublic: (key: string) => Promise<number | undefined>;
  copyToPrivate: (key: string) => Promise<void>;
  deletePublic: (key: string) => Promise<void>;
}

export interface MigrateResult {
  scanned: number;
  privateCandidates: number;
  alreadyMoved: number;
  copied: number;
  deleted: number;
  failed: { key: string; error: string }[];
  next?: string;
  dryRun: boolean;
}

/** Handles ONE page of the public bucket (the caller keeps calling with `next` until it is undefined). */
export async function migratePrivate(deps: MigrateDeps, opts: { token?: string; deleteOriginals?: boolean; dryRun?: boolean }): Promise<MigrateResult> {
  const dryRun = opts.dryRun ?? true;
  const out: MigrateResult = { scanned: 0, privateCandidates: 0, alreadyMoved: 0, copied: 0, deleted: 0, failed: [], dryRun };
  const page = await deps.listPublic(opts.token);
  out.scanned = page.keys.length;
  out.next = page.next;
  for (const key of page.keys) {
    if (!isPrivateKey(key)) continue;
    out.privateCandidates++;
    if (dryRun) continue;
    try {
      const original = await deps.sizePublic(key);
      let copy = await deps.sizePrivate(key);
      if (copy === undefined) {
        if (original === undefined) continue;                       // vanished meanwhile
        await deps.copyToPrivate(key);
        copy = await deps.sizePrivate(key);
        out.copied++;
      } else {
        out.alreadyMoved++;
      }
      if (copy === undefined || (original !== undefined && copy !== original)) throw new Error('The copy is missing or a different size, so the original was kept.');
      if (opts.deleteOriginals) {
        await deps.deletePublic(key);
        out.deleted++;
      }
    } catch (e) {
      out.failed.push({ key, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
