import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadWeather, readLastWeather, saveLastWeather } from '@/data/weather';
import { weatherSwitch } from '@/data/publicWeather';
import type { TownKey } from '@/lib/weatherTowns';
import type { WeatherPayload } from '@/lib/weatherView';

export type WeatherView =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: WeatherPayload }
  /** A fresh answer could not be had: this is the last good one, and how old it is is shown with it. */
  | { status: 'stale'; data: WeatherPayload }
  | { status: 'unavailable'; data: null };

const REFRESH_MS = 10 * 60_000;

/** The forecast for a town: the saved one at once, a fresh one right after, and a new one every 10 minutes and whenever the app comes back. */
export function useWeather(town: TownKey): { view: WeatherView; refresh: () => void; busy: boolean } {
  const [view, setView] = useState<WeatherView>({ status: 'loading', data: null });
  const [busy, setBusy] = useState(false);
  const current = useRef<TownKey>(town);
  current.current = town;
  const have = useRef<WeatherPayload | null>(null);

  const refresh = useCallback(async () => {
    const asked = current.current;
    setBusy(true);
    const r = await loadWeather(asked);
    if (asked !== current.current) return;
    setBusy(false);
    if (r.ok) {
      have.current = r.data;
      void saveLastWeather(r.data);
      setView(r.stale ? { status: 'stale', data: r.data } : { status: 'ready', data: r.data });
      return;
    }
    if (r.reason === 'disabled') {
      // The owner switched Weather off: ask the switch now, so a visitor is moved to the welcome screen straight away.
      void weatherSwitch.refresh();
      return;
    }
    setView(have.current ? { status: 'stale', data: have.current } : { status: 'unavailable', data: null });
  }, []);

  useEffect(() => {
    let alive = true;
    have.current = null;
    setView({ status: 'loading', data: null });
    readLastWeather(town).then((saved) => {
      if (!alive || !saved || have.current) return;
      have.current = saved;
      setView({ status: 'stale', data: saved });
    });
    void refresh();
    const timer = setInterval(() => { void refresh(); }, REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refresh(); });
    return () => { alive = false; clearInterval(timer); sub.remove(); };
  }, [town, refresh]);

  return { view, refresh: () => { void refresh(); }, busy };
}
