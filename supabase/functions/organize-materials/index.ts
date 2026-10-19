/**
 * Edge Function: organize-materials
 *
 * The owner's private notes for a project ("12 yards mulch, 40 ft edging, check the drain by the fence, use pavers...") are sent
 * here and come back as a clean materials list grouped by category, ready to print for a vendor. The AI only sorts what the
 * notes say: it never invents items or quantities (a missing quantity comes back empty).
 *
 * Who may call it: a signed-in company OWNER (it uses a paid AI key, so nobody else can run it).
 *
 * Deploy:  supabase functions deploy organize-materials   (or Dashboard → Edge Functions → Deploy a new function → Via Editor;
 *          keep "Enforce JWT verification" ON)
 * Secrets: ANTHROPIC_API_KEY   — an API key from console.anthropic.com (the only place it is stored)
 *          ORGANIZE_MODEL      — optional; defaults to claude-haiku-5-5
 */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const MAX_CHARS = 12000;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SYSTEM = `You turn a landscaping contractor's private job notes into a clean materials list to show a vendor.
Rules:
- Only use what the notes say. Never invent items, brands, prices or quantities. If a quantity is not stated, use null.
- Keep the contractor's own wording for each item, tidied. Put sizes, colors or types in "notes" (for example "dark brown, double shredded").
- Group items by a short category such as Mulch, Stone, Plants, Edging, Soil, Pavers, Hardware, Tools, Other.
- Anything in the notes that is not a material to buy (measurements of the area, access, reminders, who to call) goes in "other_notes", one short line each.
- Reply with ONLY one JSON object, no other text, in exactly this shape:
{"title": string, "items": [{"category": string, "item": string, "quantity": number|null, "unit": string, "notes": string}], "other_notes": [string]}`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return reply({ error: 'ai_not_configured' }, 503);

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return reply({ error: 'sign_in_required' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return reply({ error: 'sign_in_required' }, 401);
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: me } = await db.from('people').select('id').eq('user_id', u.user.id).maybeSingle();
    if (!me) return reply({ error: 'sign_in_required' }, 401);
    const { data: owner } = await db.from('company_members').select('role').eq('person_id', me.id).eq('status', 'active').eq('role', 'owner').limit(1).maybeSingle();
    if (!owner) return reply({ error: 'not_allowed' }, 403);

    const body = await req.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const projectName = typeof body.projectName === 'string' ? body.projectName.slice(0, 120) : 'the project';
    if (!text) return reply({ error: 'no_notes' }, 400);
    if (text.length > MAX_CHARS) return reply({ error: 'too_long' }, 413);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('ORGANIZE_MODEL') ?? 'claude-haiku-5-5',
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Project: ${projectName}\n\nNotes:\n${text}` }],
      }),
    });
    if (!res.ok) return reply({ error: 'ai_failed', status: res.status, detail: (await res.text()).slice(0, 200) }, 502);
    const out = await res.json();
    const raw: string = (out?.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return reply({ error: 'bad_answer' }, 502);
    try {
      return reply({ ok: true, list: JSON.parse(raw.slice(start, end + 1)) });
    } catch {
      return reply({ error: 'bad_answer' }, 502);
    }
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : 'Something went wrong' }, 500);
  }
});
