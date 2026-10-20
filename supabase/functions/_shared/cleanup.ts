/**
 * Storage cleanup for permanently deleted companies (update 68).
 *
 * The database deletes a company's rows in ONE all-or-nothing step and, in that same step, writes every stored file of the company to
 * storage_cleanup_queue. Files live in the media storage (R2), which a database transaction cannot reach, so the two can NOT be one atomic
 * operation. This job closes the gap: it claims queued items, deletes the files, and records the result. A failure is retried with a growing
 * delay and, after too many attempts, marked failed for an operator to look at. Nothing is reported as deleted until the storage confirms it
 * (or says the file is already gone).
 *
 * Pure logic with injected dependencies, so it is tested without Deno, a network or real storage credentials.
 */
export interface QueueItem { id: string; file_key: string; attempts: number; company_id: string }

export interface CleanupDeps {
  claim: (limit: number) => Promise<QueueItem[]>;
  finish: (id: string, ok: boolean, error?: string | null) => Promise<void>;
  /** true when the file is gone (deleted now or already missing). Throws or returns false on a failure. */
  deleteObject: (key: string) => Promise<boolean>;
}

export interface CleanupSummary { claimed: number; done: number; retrying: number; errors: string[] }

/** Safety: a key may never be empty, absolute, or climb out of its folder. */
export function isSafeKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0 && !key.startsWith('/') && !key.includes('..') && !key.includes('\0');
}

export async function runCleanup(deps: CleanupDeps, opts: { batch?: number } = {}): Promise<CleanupSummary> {
  const items = await deps.claim(opts.batch ?? 25);
  const out: CleanupSummary = { claimed: items.length, done: 0, retrying: 0, errors: [] };
  for (const item of items) {
    try {
      if (!isSafeKey(item.file_key)) throw new Error(`Refusing an unsafe file name: ${item.file_key}`);
      const ok = await deps.deleteObject(item.file_key);
      if (!ok) throw new Error('The storage refused to delete the file.');
      await deps.finish(item.id, true);
      out.done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      out.errors.push(`${item.id}: ${msg}`);
      out.retrying++;
      try { await deps.finish(item.id, false, msg.slice(0, 500)); } catch { /* the lock expires and it is claimed again */ }
    }
  }
  return out;
}
