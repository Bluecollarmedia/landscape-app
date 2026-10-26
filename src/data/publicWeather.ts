/**
 * The public Weather master switch, as the app reads it (supabase/updates/103). One anonymous question to the database ("is Weather on?")
 * and a small remembered answer on the phone. All the deciding lives in src/lib/weatherSwitch.ts.
 *
 * Nothing here can turn Weather on: the owner-only function that changes it is not called from anywhere in the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { createWeatherSwitch, type CachedAnswer } from '@/lib/weatherSwitch';

const KEY = 'publicWeather.v1';
/** The decision never waits for this (it waits at most REQUEST_CAP_MS); this only stops a request that never finishes. */
const HARD_STOP_MS = 15_000;

async function fetchAnswer(): Promise<boolean> {
  if (!isSupabaseConfigured) throw new Error('No backend configured.');
  const work = Promise.resolve(supabase.rpc('public_weather_config'));
  const stop = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out.')), HARD_STOP_MS));
  const { data, error } = await Promise.race([work, stop]);
  if (error) throw new Error(error.message);
  return (data as { enabled?: unknown } | null)?.enabled === true;
}

async function readCache(): Promise<CachedAnswer | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  const v = JSON.parse(raw) as Partial<CachedAnswer>;
  return typeof v.checkedAt === 'number' ? { enabled: v.enabled === true, checkedAt: v.checkedAt } : null;
}

async function writeCache(c: CachedAnswer): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(c));
}

export const weatherSwitch = createWeatherSwitch({
  fetchAnswer,
  readCache,
  writeCache,
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
});
