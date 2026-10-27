/** The towns Brighton Weather supports (the same keys as supabase/functions/weather/index.ts; a check keeps the two lists identical). */
export const WEATHER_TOWNS = [
  { key: 'lakewood', name: 'Lakewood', lat: 40.0771, lon: -74.1985 },
  { key: 'jackson', name: 'Jackson', lat: 40.0909, lon: -74.3613 },
  { key: 'howell', name: 'Howell', lat: 40.1781, lon: -74.2062 },
  { key: 'toms-river', name: 'Toms River', lat: 39.9943, lon: -74.1662 },
  { key: 'brick', name: 'Brick', lat: 40.0618, lon: -74.1096 },
  { key: 'manchester', name: 'Manchester', lat: 39.9616, lon: -74.3753 },
  { key: 'freehold', name: 'Freehold', lat: 40.2602, lon: -74.2759 },
  { key: 'point-pleasant', name: 'Point Pleasant', lat: 40.0777, lon: -74.0699 },
] as const;

export type TownKey = (typeof WEATHER_TOWNS)[number]['key'];
export const DEFAULT_TOWN: TownKey = 'lakewood';
export const isTownKey = (v: unknown): v is TownKey => WEATHER_TOWNS.some((t) => t.key === v);
export const townName = (key: string): string => WEATHER_TOWNS.find((t) => t.key === key)?.name ?? key;
/** The town's point (the same one the data function uses), for working out sunrise and sunset. */
export const townCoords = (key: string): { lat: number; lon: number } => {
  const t = WEATHER_TOWNS.find((x) => x.key === key) ?? WEATHER_TOWNS[0];
  return { lat: t.lat, lon: t.lon };
};
