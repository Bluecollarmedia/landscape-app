/** The towns Brighton Weather supports (the same keys as supabase/functions/weather/index.ts; a check keeps the two lists identical). */
export const WEATHER_TOWNS = [
  { key: 'lakewood', name: 'Lakewood' },
  { key: 'jackson', name: 'Jackson' },
  { key: 'howell', name: 'Howell' },
  { key: 'toms-river', name: 'Toms River' },
  { key: 'brick', name: 'Brick' },
  { key: 'manchester', name: 'Manchester' },
  { key: 'freehold', name: 'Freehold' },
  { key: 'point-pleasant', name: 'Point Pleasant' },
] as const;

export type TownKey = (typeof WEATHER_TOWNS)[number]['key'];
export const DEFAULT_TOWN: TownKey = 'lakewood';
export const isTownKey = (v: unknown): v is TownKey => WEATHER_TOWNS.some((t) => t.key === v);
export const townName = (key: string): string => WEATHER_TOWNS.find((t) => t.key === key)?.name ?? key;
