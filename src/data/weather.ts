/**
 * Brighton Weather data, as the app reads it: one call to the `weather` function (supabase/functions/weather) for the chosen town, and the
 * last good answer kept on the phone so a dropped connection still shows something (with its age).
 *
 * The function refuses while the owner's public Weather switch is off (403 "disabled"); that is passed up so the app can leave Weather.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { DEFAULT_TOWN, isTownKey, type TownKey } from '@/lib/weatherTowns';
import { completePayload, type WeatherPayload } from '@/lib/weatherView';

const TOWN_KEY = 'weather.town.v1';
const cacheKey = (town: string) => `weather.last.${town}.v1`;
const REQUEST_LIMIT_MS = 12_000;

export type WeatherResult =
  | { ok: true; data: WeatherPayload; stale: boolean }
  | { ok: false; reason: 'disabled' | 'unavailable' };

export async function loadWeather(town: TownKey): Promise<WeatherResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'unavailable' };
  try {
    const call = supabase.functions.invoke('weather', { body: { town } });
    const stop = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out.')), REQUEST_LIMIT_MS));
    const { data, error } = await Promise.race([Promise.resolve(call), stop]);
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return { ok: false, reason: status === 403 ? 'disabled' : 'unavailable' };
    }
    const body = data as { ok?: boolean; stale?: boolean; data?: WeatherPayload } | null;
    if (!body?.ok || !body.data) return { ok: false, reason: 'unavailable' };
    return { ok: true, data: completePayload(body.data), stale: !!body.stale };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function readLastWeather(town: TownKey): Promise<WeatherPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(town));
    if (!raw) return null;
    const v = JSON.parse(raw) as WeatherPayload;
    return v && v.town === town && typeof v.fetchedAt === 'number' ? completePayload(v) : null;
  } catch {
    return null;
  }
}
export async function saveLastWeather(data: WeatherPayload): Promise<void> {
  try { await AsyncStorage.setItem(cacheKey(data.town), JSON.stringify(data)); } catch { /* the phone's storage is best effort */ }
}

export async function readTown(): Promise<TownKey> {
  try {
    const v = await AsyncStorage.getItem(TOWN_KEY);
    return isTownKey(v) ? v : DEFAULT_TOWN;
  } catch {
    return DEFAULT_TOWN;
  }
}
export async function saveTown(town: TownKey): Promise<void> {
  try { await AsyncStorage.setItem(TOWN_KEY, town); } catch { /* best effort */ }
}
