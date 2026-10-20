/**
 * Edge Function: storage-cleanup
 *
 * Deletes the stored files of permanently deleted companies (the queue is filled by delete_my_company, update 68).
 * NOT called by the app. An operator (or a schedule, e.g. every 15 minutes) calls it with the secret in the x-cleanup-secret header.
 * Secrets needed: CLEANUP_SECRET (a long random value), plus the R2 secrets the other media functions already use.
 * Each run claims a small batch, deletes the files, and records the result. Failures are retried later with a growing delay and are
 * marked failed after 8 attempts (see storage_cleanup_status()). The service role is used only here, never in the app.
 */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getServiceClient } from '../_shared/auth.ts';
import { deleteR2Object } from '../_shared/r2.ts';
import { runCleanup, type QueueItem } from '../_shared/cleanup.ts';

const SECRET = Deno.env.get('CLEANUP_SECRET') ?? '';

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const given = req.headers.get('x-cleanup-secret') ?? '';
  if (!SECRET || SECRET.length < 24 || !same(given, SECRET)) return new Response('Forbidden', { status: 403 });

  const db = getServiceClient();
  const summary = await runCleanup({
    claim: async (limit) => {
      const { data, error } = await db.rpc('storage_cleanup_claim', { p_limit: limit });
      if (error) throw new Error(error.message);
      return (data ?? []) as QueueItem[];
    },
    finish: async (id, ok, error) => {
      const { error: e } = await db.rpc('storage_cleanup_finish', { p_id: id, p_ok: ok, p_error: error ?? null });
      if (e) throw new Error(e.message);
    },
    deleteObject: deleteR2Object,
  });
  const { data: status } = await db.rpc('storage_cleanup_status');
  return new Response(JSON.stringify({ summary, status }), { headers: { 'Content-Type': 'application/json' } });
});
