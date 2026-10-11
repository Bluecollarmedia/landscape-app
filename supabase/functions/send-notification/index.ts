/**
 * Edge Function: send-notification
 *
 * Called by the database (trigger app_notifications_push, update 008) each
 * time an in-app notification is created. It:
 *   1. sends it as a push to every phone the person is signed in on
 *      (Expo push service → Apple / Google), and
 *   2. for an approved or declined quote / change order, also emails the
 *      owner (Resend), with a link to the document.
 *
 * The request carries only the notification's id. The function reads the
 * notification itself and marks it sent, so each one goes out at most once
 * and the endpoint can't be used to send anything else.
 *
 * Deploy:  supabase functions deploy send-notification --no-verify-jwt
 * Secrets (supabase secrets set …):
 *   RESEND_API_KEY      — from resend.com; without it no email is sent
 *   NOTIFY_EMAIL_FROM   — e.g. "Brighton Lawn + Landscape <quotes@brightonlawn.com>"
 *                         (a domain verified in Resend; defaults to Resend's test sender)
 *   APP_WEB_URL         — where the web app is hosted, e.g. https://app.brightonlawn.com
 */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getServiceClient } from '../_shared/auth.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EMAIL_EVENTS = new Set(['quote_approved', 'quote_declined']);
/** Older notifications are never (re)sent. */
const MAX_AGE_MS = 15 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let id: string | undefined;
  try {
    id = (await req.json())?.id;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'bad_request' }, 400);

  const db = getServiceClient();

  // Claim it: only the first call for a fresh notification gets a row back.
  const { data: n, error } = await db
    .from('app_notifications')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', id)
    .is('pushed_at', null)
    .gt('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
    .select('id, recipient_id, event_type, title, body, linked_entity_type, linked_entity_id')
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!n) return json({ skipped: true });

  const [push, email] = await Promise.allSettled([sendPush(db, n), EMAIL_EVENTS.has(n.event_type) ? sendEmail(db, n) : Promise.resolve('skipped')]);
  return json({
    push: push.status === 'fulfilled' ? push.value : String(push.reason),
    email: email.status === 'fulfilled' ? email.value : String(email.reason),
  });
});

type Db = ReturnType<typeof getServiceClient>;
interface Notification {
  id: string;
  recipient_id: string;
  event_type: string;
  title: string;
  body: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
}

async function sendPush(db: Db, n: Notification): Promise<string> {
  const { data: tokens } = await db.from('push_tokens').select('token').eq('person_id', n.recipient_id);
  if (!tokens?.length) return 'no devices';

  const { count } = await db
    .from('app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', n.recipient_id)
    .eq('status', 'unread');

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: n.title,
    body: n.body || undefined,
    sound: 'default',
    badge: count ?? undefined,
    data: {
      notificationId: n.id,
      eventType: n.event_type,
      linkedEntityType: n.linked_entity_type,
      linkedEntityId: n.linked_entity_id,
    },
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const out = await res.json().catch(() => null);
  if (!res.ok) return `expo error ${res.status}`;

  // Forget phones that uninstalled the app or turned notifications off for good.
  const tickets: { status: string; details?: { error?: string } }[] = out?.data ?? [];
  const dead = tickets
    .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? messages[i].to : null))
    .filter((t): t is string => !!t);
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);

  return `sent to ${tickets.filter((t) => t.status === 'ok').length} of ${messages.length}`;
}

async function sendEmail(db: Db, n: Notification): Promise<string> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return 'no RESEND_API_KEY';

  const { data: person } = await db.from('people').select('email, first_name').eq('id', n.recipient_id).maybeSingle();
  if (!person?.email) return 'no email address';

  const table = n.linked_entity_type === 'quote' ? 'quotes' : n.linked_entity_type === 'change_order' ? 'change_orders' : null;
  const doc = table && n.linked_entity_id
    ? (await db.from(table).select('number, total, share_token, project_id, approved_name, decline_reason').eq('id', n.linked_entity_id).maybeSingle()).data
    : null;
  const project = doc
    ? (await db.from('projects').select('name, address, city').eq('id', doc.project_id).maybeSingle()).data
    : null;

  const webUrl = (Deno.env.get('APP_WEB_URL') ?? '').replace(/\/+$/, '');
  const link = webUrl && doc?.share_token ? `${webUrl}/approve/${doc.share_token}` : null;
  const approved = n.event_type === 'quote_approved';
  const total = doc ? Number(doc.total).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : null;
  const when = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' });

  const rows: [string, string | null | undefined][] = [
    ['Project', project ? [project.name, project.address, project.city].filter(Boolean).join(', ') : null],
    ['Total', total],
    [approved ? 'Approved by' : 'Declined by', doc?.approved_name || n.body?.match(/^By (.+?)(?: · |$)/)?.[1]],
    ['When', when],
    ['Reason', approved ? null : doc?.decline_reason],
  ];
  const html = `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1B3A2D;max-width:520px">
  <p style="font-size:18px;font-weight:600;margin:0 0 12px">${esc(n.title)}</p>
  <table style="border-collapse:collapse;font-size:14px">
    ${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6B7570">${esc(k)}</td><td style="padding:4px 0">${esc(String(v))}</td></tr>`).join('')}
  </table>
  ${link ? `<p style="margin:20px 0"><a href="${esc(link)}" style="background:#7CB342;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">View ${approved ? 'approved ' : ''}document &amp; PDF</a></p>` : ''}
  <p style="font-size:12px;color:#8A948F">Sent by the Brighton app. It's also in your notifications.</p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('NOTIFY_EMAIL_FROM') ?? 'Brighton Lawn + Landscape <onboarding@resend.dev>',
      to: [person.email],
      subject: n.title,
      html,
    }),
  });
  return res.ok ? 'emailed' : `resend error ${res.status}: ${(await res.text()).slice(0, 200)}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
