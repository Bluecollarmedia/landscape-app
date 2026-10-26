/**
 * weather — Brighton Weather's data source: the National Weather Service (NWS) API, read on the server and shaped into one small answer.
 *
 * The app never talks to NWS itself. It asks this function for a town, and the function:
 *   1. refuses unless the owner's public Weather switch is ON (public_weather_config, update 103), so nothing is served while Weather is off;
 *   2. only answers for the eight supported towns (fixed list below, each point from the US Census and checked against NWS);
 *   3. reads NWS (forecast, hourly, raw grid for snowfall, active alerts), converts it, and keeps the answer for 10 minutes;
 *   4. if NWS is unreachable, hands back the last good answer marked stale, or says it is unavailable.
 * NWS needs no key; it asks for a User-Agent that says who is calling. Set the secret NWS_CONTACT to an email to add it (optional).
 *
 * Nothing here invents data: a missing snowfall number comes back as null ("unavailable"), never as 0.
 * This is ONE self-contained file (it can be pasted into the Supabase dashboard as it is). Everything above the marker line below is pure
 * code with no imports, and scripts/checks/weatherData.check.cjs runs it in Node against real NWS responses.
 */

// ───────────────────────────── pure part (no imports) ─────────────────────────────

export interface Town { name: string; lat: number; lon: number; office: string; gridX: number; gridY: number; zone: string; tz: string }

/** The supported towns. lat/lon: US Census 2023 Gazetteer internal point of the municipality, rounded to 4 decimals (the precision NWS accepts).
 *  grid/zone: from NWS /points for that point (2026-10-26). Freehold means the borough. */
export const TOWNS: Record<string, Town> = {
  'lakewood': { name: 'Lakewood', lat: 40.0771, lon: -74.1985, office: 'PHI', gridX: 82, gridY: 89, zone: 'NJZ020', tz: 'America/New_York' },
  'jackson': { name: 'Jackson', lat: 40.0909, lon: -74.3613, office: 'PHI', gridX: 76, gridY: 89, zone: 'NJZ020', tz: 'America/New_York' },
  'howell': { name: 'Howell', lat: 40.1781, lon: -74.2062, office: 'PHI', gridX: 81, gridY: 94, zone: 'NJZ013', tz: 'America/New_York' },
  'toms-river': { name: 'Toms River', lat: 39.9943, lon: -74.1662, office: 'PHI', gridX: 84, gridY: 86, zone: 'NJZ020', tz: 'America/New_York' },
  'brick': { name: 'Brick', lat: 40.0618, lon: -74.1096, office: 'PHI', gridX: 85, gridY: 89, zone: 'NJZ020', tz: 'America/New_York' },
  'manchester': { name: 'Manchester', lat: 39.9616, lon: -74.3753, office: 'PHI', gridX: 77, gridY: 83, zone: 'NJZ020', tz: 'America/New_York' },
  'freehold': { name: 'Freehold', lat: 40.2602, lon: -74.2759, office: 'PHI', gridX: 78, gridY: 97, zone: 'NJZ013', tz: 'America/New_York' },
  'point-pleasant': { name: 'Point Pleasant', lat: 40.0777, lon: -74.0699, office: 'PHI', gridX: 87, gridY: 90, zone: 'NJZ026', tz: 'America/New_York' },
};

export type WxIcon = 'sun' | 'moon' | 'partly' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm';

export interface WxHour { time: string; tempF: number | null; popPct: number | null; icon: WxIcon }
export interface WxDay { date: string; highF: number | null; lowF: number | null; popPct: number | null; icon: WxIcon; text: string; snowIn: number | null }
export interface WxAlert { id: string; event: string; severity: string; urgency: string; headline: string; description: string; instruction: string; sender: string; effective: string | null; expires: string | null }
export interface WeatherPayload {
  town: string;
  townName: string;
  fetchedAt: number;
  updatedAt: string | null;
  current: { tempF: number | null; text: string; icon: WxIcon; isDaytime: boolean } | null;
  today: { highF: number | null; lowF: number | null };
  hourly: WxHour[];
  daily: WxDay[];
  alerts: WxAlert[];
  source: string;
}

/** One word for the picture, from NWS's own short text (never from anything invented). */
export function iconFor(shortForecast: string, isDaytime: boolean): WxIcon {
  const t = (shortForecast || '').toLowerCase();
  if (/thunder|t-storm/.test(t)) return 'storm';
  if (/snow|blizzard|flurr|sleet|wintry|freezing/.test(t)) return 'snow';
  if (/rain|shower|drizzle/.test(t)) return 'rain';
  if (/fog|haze|mist|smoke/.test(t)) return 'fog';
  if (/partly|mostly sunny|mostly clear/.test(t)) return isDaytime ? 'partly' : 'moon';
  if (/cloud|overcast/.test(t)) return 'cloud';
  if (/sunny|clear|fair/.test(t)) return isDaytime ? 'sun' : 'moon';
  return 'cloud';
}

const HOUR = 3_600_000;
const floorHour = (ms: number) => Math.floor(ms / HOUR) * HOUR;

/** "2026-10-26T14:00:00+00:00/PT4H" or ".../P5DT22H" -> start and end in ms. null when it cannot be read. */
export function parseValidTime(vt: string): { start: number; end: number } | null {
  const [a, d] = String(vt || '').split('/');
  const start = Date.parse(a);
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(d || '');
  if (!Number.isFinite(start) || !m) return null;
  const ms = (Number(m[1] || 0) * 24 + Number(m[2] || 0)) * HOUR + Number(m[3] || 0) * 60_000;
  return ms > 0 ? { start, end: start + ms } : null;
}

export function localDate(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

const toInches = (uom: string): number | null =>
  uom === 'wmoUnit:mm' ? 1 / 25.4 : uom === 'wmoUnit:cm' ? 10 / 25.4 : uom === 'wmoUnit:m' ? 1000 / 25.4 : null;

/**
 * Snowfall forecast in inches per local calendar day, from NWS's raw grid (snowfallAmount blocks of several hours).
 * A day gets a number ONLY when every hour of it (from `fromMs` on) is covered by a block with a real number. Otherwise the day is null
 * ("unavailable"). A real 0 stays 0. Unknown units give null for every day.
 */
export function snowByLocalDay(values: Array<{ validTime: string; value: number | null }> | undefined, uom: string, fromMs: number, toMs: number, tz: string): Record<string, number | null> {
  const factor = toInches(uom);
  const perHour = new Map<number, number>();
  if (factor !== null) {
    for (const b of values ?? []) {
      const span = parseValidTime(b.validTime);
      if (!span || typeof b.value !== 'number' || !Number.isFinite(b.value)) continue;
      const hours = (span.end - span.start) / HOUR;
      for (let t = floorHour(span.start); t < span.end; t += HOUR) perHour.set(t, (b.value * factor) / hours);
    }
  }
  const days: Record<string, { sum: number; missing: boolean }> = {};
  for (let t = floorHour(fromMs); t < toMs; t += HOUR) {
    const d = localDate(t, tz);
    const rec = (days[d] ??= { sum: 0, missing: false });
    const v = perHour.get(t);
    if (v === undefined) rec.missing = true; else rec.sum += v;
  }
  const out: Record<string, number | null> = {};
  for (const [d, r] of Object.entries(days)) out[d] = r.missing ? null : Math.round(r.sum * 10) / 10;
  return out;
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const tempF = (p: { temperature?: unknown; temperatureUnit?: string }): number | null => {
  const t = numOrNull(p.temperature);
  if (t === null) return null;
  return p.temperatureUnit === 'C' ? Math.round((t * 9) / 5 + 32) : Math.round(t);
};
const popOf = (p: { probabilityOfPrecipitation?: { value?: unknown } | null }): number | null => numOrNull(p.probabilityOfPrecipitation?.value);

const SEVERITY_RANK: Record<string, number> = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };

/** Alerts that are in force: real (Actual), not cancelled, not expired. The agency's own words are passed through untouched. */
export function normalizeAlerts(alerts: any, now: number): WxAlert[] {
  const out: WxAlert[] = [];
  for (const f of alerts?.features ?? []) {
    const p = f?.properties ?? {};
    if (p.status !== 'Actual' || p.messageType === 'Cancel') continue;
    const end = Date.parse(p.ends ?? p.expires ?? '');
    if (Number.isFinite(end) && end <= now) continue;
    out.push({
      id: String(p.id ?? f.id ?? ''), event: String(p.event ?? ''), severity: String(p.severity ?? 'Unknown'), urgency: String(p.urgency ?? ''),
      headline: String(p.headline ?? ''), description: String(p.description ?? ''), instruction: String(p.instruction ?? ''),
      sender: String(p.senderName ?? ''), effective: p.effective ?? null, expires: p.expires ?? null,
    });
  }
  return out.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4));
}

/** NWS forecast + hourly + raw grid + alerts -> the small answer the app shows. */
export function normalizeForecast(input: { townKey: string; forecast: any; hourly: any; grid: any; alerts: any; now: number }): WeatherPayload {
  const town = TOWNS[input.townKey];
  const tz = town?.tz ?? 'America/New_York';
  const now = input.now;
  const periods: any[] = input.forecast?.properties?.periods ?? [];
  const hoursAll: any[] = input.hourly?.properties?.periods ?? [];

  // Hourly: the period we are in, then the next 11.
  let firstIdx = hoursAll.findIndex((p) => Date.parse(p.startTime) <= now && now < Date.parse(p.endTime));
  if (firstIdx < 0) firstIdx = hoursAll.findIndex((p) => Date.parse(p.startTime) > now);
  const hourSlice = firstIdx < 0 ? [] : hoursAll.slice(firstIdx, firstIdx + 12);
  const hourly: WxHour[] = hourSlice.map((p) => ({ time: p.startTime, tempF: tempF(p), popPct: popOf(p), icon: iconFor(p.shortForecast, !!p.isDaytime) }));
  const cur = hourSlice[0];
  const current = cur ? { tempF: tempF(cur), text: String(cur.shortForecast ?? ''), icon: iconFor(cur.shortForecast, !!cur.isDaytime), isDaytime: !!cur.isDaytime } : null;

  // Snowfall per local day from the raw grid.
  const snow = snowByLocalDay(input.grid?.properties?.snowfallAmount?.values, input.grid?.properties?.snowfallAmount?.uom ?? '', now, now + 9 * 24 * HOUR, tz);

  // Daily: group the 12-hour day/night periods by the local date they start on.
  const byDate = new Map<string, { day?: any; night?: any }>();
  for (const p of periods) {
    const d = localDate(Date.parse(p.startTime), tz);
    const rec = byDate.get(d) ?? {};
    if (p.isDaytime) rec.day = p; else rec.night = p;
    byDate.set(d, rec);
  }
  const daily: WxDay[] = [...byDate.entries()].slice(0, 7).map(([date, r]) => {
    const lead = r.day ?? r.night;
    const pops = [r.day, r.night].map((p) => (p ? popOf(p) : null)).filter((v): v is number => v !== null);
    return {
      date,
      highF: r.day ? tempF(r.day) : null,
      lowF: r.night ? tempF(r.night) : null,
      popPct: pops.length ? Math.max(...pops) : null,
      icon: iconFor(lead?.shortForecast ?? '', !!r.day),
      text: String(lead?.shortForecast ?? ''),
      snowIn: Object.prototype.hasOwnProperty.call(snow, date) ? snow[date] : null,
    };
  });

  const temps = hourSlice.map((p) => tempF(p)).filter((v): v is number => v !== null);
  const today = {
    highF: daily[0]?.highF ?? (temps.length ? Math.max(...temps) : null),
    lowF: daily[0]?.lowF ?? (temps.length ? Math.min(...temps) : null),
  };

  return {
    town: input.townKey,
    townName: town?.name ?? input.townKey,
    fetchedAt: now,
    updatedAt: input.forecast?.properties?.generatedAt ?? input.forecast?.properties?.updateTime ?? null,
    current,
    today,
    hourly,
    daily,
    alerts: normalizeAlerts(input.alerts, now),
    source: 'National Weather Service',
  };
}

// ───────────────────────────── Deno edge function below ─────────────────────────────
// @ts-ignore: Deno edge runtime
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
// @ts-ignore: Deno edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

declare const Deno: { env: { get(k: string): string | undefined } };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const CONTACT = Deno.env.get('NWS_CONTACT');
const USER_AGENT = `BrightonLawnWeather/1.0 (app.brightonlawn.com${CONTACT ? `, ${CONTACT}` : ''})`;
const TTL_MS = 10 * 60 * 1000;
const NWS_TIMEOUT_MS = 8000;

// Best-effort memory of recent answers (a warm instance keeps it; a cold one starts empty).
const memory = new Map<string, { at: number; payload: WeatherPayload }>();

async function nws(path: string): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), NWS_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.weather.gov${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' }, signal: ctl.signal });
    if (!res.ok) throw new Error(`NWS ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function weatherIsOn(): Promise<boolean | null> {
  try {
    const sb = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await sb.rpc('public_weather_config');
    if (error) return null;
    return (data as { enabled?: unknown } | null)?.enabled === true;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  let townKey = '';
  try { townKey = String(((await req.json()) as { town?: unknown })?.town ?? ''); } catch { /* handled below */ }
  const town = TOWNS[townKey];
  if (!town) return json(400, { error: 'town' });

  // Nothing is served while the owner has Weather switched off (or when the switch cannot be read).
  const on = await weatherIsOn();
  if (on === null) return json(503, { error: 'unavailable' });
  if (!on) return json(403, { error: 'disabled' });

  const cached = memory.get(townKey);
  if (cached && Date.now() - cached.at < TTL_MS) return json(200, { ok: true, stale: false, data: cached.payload });

  try {
    const grid = `/gridpoints/${town.office}/${town.gridX},${town.gridY}`;
    const [forecast, hourly, gridData, alerts] = await Promise.all([
      nws(`${grid}/forecast`), nws(`${grid}/forecast/hourly`), nws(grid), nws(`/alerts/active?zone=${town.zone}`),
    ]);
    const payload = normalizeForecast({ townKey, forecast, hourly, grid: gridData, alerts, now: Date.now() });
    memory.set(townKey, { at: Date.now(), payload });
    return json(200, { ok: true, stale: false, data: payload });
  } catch {
    if (cached) return json(200, { ok: true, stale: true, data: cached.payload });
    return json(502, { error: 'unavailable' });
  }
});
