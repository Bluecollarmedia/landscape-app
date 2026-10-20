/**
 * Edge Function: private-migrate
 *
 * One-time tool: moves the existing maintenance photos, Snow media and ID photos from the public R2 bucket into the private one.
 * NOT called by the app. Run it by hand (see docs/media-pipeline.md) with the secret in the x-migrate-secret header.
 * Secrets needed: MIGRATE_SECRET (a long random value), plus the R2 secrets the media function already uses, including R2_PRIVATE_BUCKET_NAME.
 *
 * Body: { "token": <the "next" from the last answer, omit for the first page>, "dryRun": true|false, "deleteOriginals": true|false }
 *   dryRun (default true): only counts what would move, changes nothing.
 *   dryRun false, deleteOriginals false: COPIES (the original stays public; nothing is lost; safe to repeat).
 *   dryRun false, deleteOriginals true: copies, checks the copy, then removes the public original. Only do this after every phone runs the
 *   app version that opens maintenance photos through signed links.
 */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import { migratePrivate } from '../_shared/migratePrivate.ts';

const SECRET = Deno.env.get('MIGRATE_SECRET') ?? '';
const ACCOUNT = Deno.env.get('R2_ACCOUNT_ID') ?? '';
const PUBLIC_BUCKET = Deno.env.get('R2_BUCKET_NAME') ?? '';
const PRIVATE_BUCKET = Deno.env.get('R2_PRIVATE_BUCKET_NAME') ?? '';
const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
  service: 's3',
  region: 'auto',
});
const host = `https://${ACCOUNT}.r2.cloudflarestorage.com`;
const PUB = `${host}/${PUBLIC_BUCKET}`;
const PRIV = `${host}/${PRIVATE_BUCKET}`;
const enc = (key: string) => key.split('/').map(encodeURIComponent).join('/');

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function size(base: string, key: string): Promise<number | undefined> {
  const res = await r2.fetch(`${base}/${enc(key)}`, { method: 'HEAD' });
  if (!res.ok) return undefined;
  const n = Number(res.headers.get('content-length'));
  return Number.isFinite(n) ? n : undefined;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const given = req.headers.get('x-migrate-secret') ?? '';
  if (!SECRET || SECRET.length < 24 || !same(given, SECRET)) return new Response('Forbidden', { status: 403 });
  if (!ACCOUNT || !PUBLIC_BUCKET || !PRIVATE_BUCKET) return new Response(JSON.stringify({ error: 'The R2 secrets (including R2_PRIVATE_BUCKET_NAME) are not all set.' }), { status: 503 });
  if (PUBLIC_BUCKET === PRIVATE_BUCKET) return new Response(JSON.stringify({ error: 'The private bucket must be a different bucket.' }), { status: 400 });

  const body = await req.json().catch(() => ({}));
  const result = await migratePrivate({
    listPublic: async (token) => {
      const u = new URL(PUB);
      u.searchParams.set('list-type', '2');
      u.searchParams.set('max-keys', '200');
      if (token) u.searchParams.set('continuation-token', token);
      const res = await r2.fetch(u.toString());
      if (!res.ok) throw new Error(`List failed (${res.status})`);
      const xml = await res.text();
      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      return { keys, next: /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] };
    },
    sizePublic: (key) => size(PUB, key),
    sizePrivate: (key) => size(PRIV, key),
    copyToPrivate: async (key) => {
      const res = await r2.fetch(`${PRIV}/${enc(key)}`, { method: 'PUT', headers: { 'x-amz-copy-source': `/${PUBLIC_BUCKET}/${enc(key)}` } });
      if (!res.ok) throw new Error(`Copy failed (${res.status})`);
    },
    deletePublic: async (key) => {
      const res = await r2.fetch(`${PUB}/${enc(key)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`Delete failed (${res.status})`);
    },
  }, { token: typeof body.token === 'string' ? body.token : undefined, dryRun: body.dryRun !== false, deleteOriginals: body.deleteOriginals === true });
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
