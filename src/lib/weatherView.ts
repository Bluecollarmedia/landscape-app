/**
 * Plain helpers for showing a weather answer (pure: no React, no network). The answer's shape is defined by the weather function
 * (supabase/functions/weather/index.ts); the types are repeated here so the app does not import server code.
 */
export type WxIcon = 'sun' | 'moon' | 'partly' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm';
export interface WxHour {
  time: string; tempF: number | null; popPct: number | null; icon: WxIcon;
  feelsF: number | null; windMph: number | null; windDir: string; gustMph: number | null;
  humidityPct: number | null; dewF: number | null; precipIn: number | null; cloudPct: number | null;
}
export interface WxDay { date: string; highF: number | null; lowF: number | null; popPct: number | null; icon: WxIcon; text: string; snowIn: number | null }
export interface WxAlert { id: string; event: string; severity: string; urgency: string; headline: string; description: string; instruction: string; sender: string; effective: string | null; expires: string | null }
export interface WeatherPayload {
  town: string; townName: string; fetchedAt: number; updatedAt: string | null;
  current: { tempF: number | null; text: string; icon: WxIcon; isDaytime: boolean } | null;
  today: { highF: number | null; lowF: number | null };
  hourly: WxHour[]; daily: WxDay[]; alerts: WxAlert[]; source: string;
}

/** How a snowfall figure is worded. null = the forecast has no figure for that day: "unavailable", never "0". */
export function snowKind(snowIn: number | null): 'unavailable' | 'none' | 'trace' | 'amount' {
  if (snowIn === null || !Number.isFinite(snowIn)) return 'unavailable';
  if (snowIn === 0) return 'none';
  if (snowIn < 0.1) return 'trace';
  return 'amount';
}

/** Whole minutes since the answer was fetched (never negative). */
export const ageMinutes = (fetchedAt: number, now: number): number => Math.max(0, Math.floor((now - fetchedAt) / 60_000));

/** The temperature to show, or an en dash when there is none. */
export const degrees = (f: number | null | undefined): string => (typeof f === 'number' && Number.isFinite(f) ? `${Math.round(f)}°` : '–');

const NY = 'America/New_York';
/** "Tue" / "mar" for a calendar date like 2026-10-27 (the weekday of that date, not shifted by the phone's time zone). */
export function weekdayShort(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
/** "4 PM" in the towns' time (Eastern), whatever time zone the phone is in. */
export function hourLabel(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: NY }).format(new Date(iso));
}
export function timeLabel(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: NY }).format(new Date(iso));
}
/** Today's date in the towns' time as YYYY-MM-DD. */
export const todayInTowns = (now: number): string => new Intl.DateTimeFormat('en-CA', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));

// ───────────── helpers for the home and details screens ─────────────

/** A number with a unit, or an en dash when NWS had no figure (callers word that as "Unavailable" where there is room). */
export const orDash = (v: number | null | undefined, unit = '', digits = 0): string =>
  typeof v === 'number' && Number.isFinite(v) ? `${digits ? v.toFixed(digits) : Math.round(v)}${unit}` : '–';

export const localDay = (iso: string): string => todayInTowns(Date.parse(iso));
/** Hours that start on a local calendar date (the towns' time). */
export const hoursOnDate = (hours: WxHour[], date: string): WxHour[] => hours.filter((h) => localDay(h.time) === date);

/** What the wind is doing, in plain words (informal bands). */
export function windWord(mph: number | null): 'Calm' | 'Light' | 'Breezy' | 'Windy' | 'Very windy' | null {
  if (mph === null || !Number.isFinite(mph)) return null;
  if (mph < 4) return 'Calm';
  if (mph < 13) return 'Light';
  if (mph < 25) return 'Breezy';
  if (mph < 39) return 'Windy';
  return 'Very windy';
}

/** How the air feels, from the dew point (the common rule of thumb). */
export function dewWord(dewF: number | null): 'Dry' | 'Comfortable' | 'A little humid' | 'Humid' | 'Very humid' | null {
  if (dewF === null || !Number.isFinite(dewF)) return null;
  if (dewF < 50) return 'Dry';
  if (dewF < 60) return 'Comfortable';
  if (dewF < 65) return 'A little humid';
  if (dewF < 70) return 'Humid';
  return 'Very humid';
}

/** The first hour in the next 24 where rain or snow is likely (40% or more), or null. */
export function firstWetHour(hours: WxHour[]): { index: number; time: string; snow: boolean } | null {
  const i = hours.slice(0, 24).findIndex((h) => typeof h.popPct === 'number' && h.popPct >= 40);
  return i < 0 ? null : { index: i, time: hours[i].time, snow: hours[i].icon === 'snow' };
}

/** Where a day's low and high sit (0..1) inside the week's range, for the temperature bar. null when a figure is missing. */
export function barSpan(day: { lowF: number | null; highF: number | null }, days: Array<{ lowF: number | null; highF: number | null }>): { from: number; to: number } | null {
  const lows = days.map((d) => d.lowF).filter((v): v is number => v !== null);
  const highs = days.map((d) => d.highF).filter((v): v is number => v !== null);
  if (!lows.length || !highs.length || day.lowF === null || day.highF === null) return null;
  const lo = Math.min(...lows);
  const span = Math.max(1, Math.max(...highs) - lo);
  return { from: (day.lowF - lo) / span, to: (day.highF - lo) / span };
}

/** A colour for a temperature, cold to hot (the day bars and the chart). Chosen to read on white. */
export function tempColor(f: number | null): string {
  if (f === null) return '#9FB3A6';
  if (f <= 32) return '#5BB3F0';
  if (f <= 50) return '#3FBF9A';
  if (f <= 65) return '#7CC25A';
  if (f <= 80) return '#E8C23A';
  if (f <= 90) return '#EE8B3A';
  return '#E5604F';
}

const DAY_MS = 86_400_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const norm = (v: number, n: number) => ((v % n) + n) % n;

/**
 * Sunrise and sunset (ms) for a calendar date and place, worked out from the date and position alone (the "Almanac for Computers" method).
 * Accurate to a few minutes. null when the sun does not rise or set that day.
 */
export function sunTimes(date: string, lat: number, lon: number): { rise: number; set: number } | null {
  const [y, m, d] = date.split('-').map(Number);
  const N = Math.floor((275 * m) / 9) - Math.floor((m + 9) / 12) * (1 + Math.floor((y - 4 * Math.floor(y / 4) + 2) / 3)) + d - 30;
  const lngHour = lon / 15;
  const calc = (rising: boolean): number | null => {
    const t = N + ((rising ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    const L = norm(M + 1.916 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 282.634, 360);
    let RA = norm(deg(Math.atan(0.91764 * Math.tan(rad(L)))), 360);
    RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(rad(L));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(rad(90.833)) - sinDec * Math.sin(rad(lat))) / (cosDec * Math.cos(rad(lat)));
    if (cosH > 1 || cosH < -1) return null;
    const H = (rising ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH))) / 15;
    const T = H + RA - 0.06571 * t - 6.622;
    return norm(T - lngHour, 24);
  };
  const r = calc(true);
  const s = calc(false);
  if (r === null || s === null) return null;
  const base = Date.UTC(y, m - 1, d);
  const rise = base + r * 3_600_000;
  let set = base + s * 3_600_000;
  if (set < rise) set += DAY_MS;
  return { rise, set };
}

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
/** Age of the moon in days (0 = new), from the date alone. */
export const moonAge = (ms: number): number => norm((ms - NEW_MOON_REF) / DAY_MS, SYNODIC);
export type MoonName = 'New Moon' | 'Waxing Crescent' | 'First Quarter' | 'Waxing Gibbous' | 'Full Moon' | 'Waning Gibbous' | 'Last Quarter' | 'Waning Crescent';
export function moonPhase(ms: number): { name: MoonName; illumination: number; age: number } {
  const age = moonAge(ms);
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  const f = age / SYNODIC;
  const name: MoonName = f < 0.03 || f >= 0.97 ? 'New Moon' : f < 0.22 ? 'Waxing Crescent' : f < 0.28 ? 'First Quarter' : f < 0.47 ? 'Waxing Gibbous' : f < 0.53 ? 'Full Moon' : f < 0.72 ? 'Waning Gibbous' : f < 0.78 ? 'Last Quarter' : 'Waning Crescent';
  return { name, illumination, age };
}
/** The next New, First Quarter, Full and Last Quarter moons after `ms`, soonest first (a mean-cycle estimate: good to about a day). */
export function nextMoons(ms: number): Array<{ name: 'New Moon' | 'First Quarter' | 'Full Moon' | 'Last Quarter'; at: number }> {
  const names = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'] as const;
  const age = moonAge(ms);
  return names.map((name, i) => ({ name, at: ms + norm((i * SYNODIC) / 4 - age, SYNODIC) * DAY_MS })).sort((a, b) => a.at - b.at);
}

/**
 * An answer from the weather function with every hourly figure present. An older version of the function (before it sent feels-like, wind,
 * humidity and so on) leaves them out; they become null ("unavailable") instead of undefined, so the screens never show NaN.
 */
export function completePayload(p: WeatherPayload): WeatherPayload {
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    ...p,
    hourly: (p.hourly ?? []).map((h) => ({
      time: h.time, tempF: n(h.tempF), popPct: n(h.popPct), icon: h.icon,
      feelsF: n(h.feelsF), windMph: n(h.windMph), windDir: typeof h.windDir === 'string' ? h.windDir : '', gustMph: n(h.gustMph),
      humidityPct: n(h.humidityPct), dewF: n(h.dewF), precipIn: n(h.precipIn), cloudPct: n(h.cloudPct),
    })),
    daily: p.daily ?? [],
    alerts: p.alerts ?? [],
  };
}
