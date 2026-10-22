/**
 * Edge Function: invite-signup
 *
 * Someone opens their private invite link and makes a login. Supabase's normal sign-up sends a second "confirm your email" message,
 * which is pointless here: the invite link itself was sent to this person by their owner and works once. So this creates the login
 * ALREADY CONFIRMED, but only when the link is valid, and the existing sign-up trigger (update 78, handle_new_user) attaches the new
 * login to the record the owner made and uses the link up. The app then signs the person in right away.
 *
 * Nobody can use this to make an arbitrary confirmed account: no valid link, no account. People starting their own company still
 * go through the normal sign-up and the normal email confirmation.
 *
 * Deploy:  supabase functions deploy invite-signup
 *          (or Supabase dashboard → Edge Functions → Deploy a new function → Via Editor; keep "Enforce JWT verification" ON,
 *          the app sends its public key, which is enough)
 * Needs no extra secrets (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already provided to every function).
 */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'bad_request' }, 400);
  }

  const token = text(body.token, 200);
  const email = text(body.email, 320).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (token.length < 32 || !looksLikeEmail(email)) return reply({ error: 'bad_request' }, 400);
  if (password.length < 6 || password.length > 200) return reply({ error: 'weak_password' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  // The link must be valid right now (not used, not cancelled, not expired).
  const { data: look } = await db.rpc('invite_lookup', { p_token: token });
  if (!look?.valid) return reply({ error: look?.reason ?? 'invalid' }, 400);

  const { data: made, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: text(body.firstName, 100),
      last_name: text(body.lastName, 100),
      phone: text(body.phone, 40),
      invite_token: token,
    },
  });
  if (error || !made?.user) {
    const msg = String(error?.message ?? '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) return reply({ error: 'email_exists' }, 409);
    return reply({ error: 'create_failed' }, 400);
  }

  // The sign-up trigger uses the link up in the same step. If it did not, do not leave a login that is attached to nothing.
  const { data: after } = await db.rpc('invite_lookup', { p_token: token });
  if (after?.valid !== false || after?.reason !== 'used') {
    await db.auth.admin.deleteUser(made.user.id);
    return reply({ error: 'link_failed' }, 500);
  }
  return reply({ ok: true });
});
