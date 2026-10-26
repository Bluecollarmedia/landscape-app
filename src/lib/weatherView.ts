/**
 * Plain helpers for showing a weather answer (pure: no React, no network). The answer's shape is defined by the weather function
 * (supabase/functions/weather/index.ts); the types are repeated here so the app does not import server code.
 */
export type WxIcon = 'sun' | 'moon' | 'partly' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm';
export interface WxHour { time: string; tempF: number | null; popPct: number | null; icon: WxIcon }
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
