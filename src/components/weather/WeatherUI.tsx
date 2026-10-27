/**
 * The building blocks of the Brighton Weather screens: the light palette (white air and tints of the logo's leaf green, text in the logo's deep
 * green), the flat white cards, the weather pictures and a small helper for the page behind everything. Flat and solid on purpose: no blur, no
 * see-through panels. Used only by the Weather screens.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { WxIcon } from '@/lib/weatherView';

/** The brand greens come from the logo file (deep #0B4736, fresh #53A246); the rest are tints and neutrals chosen to sit with them. */
export const WX = {
  page: '#F7FAF4',
  card: '#FFFFFF',
  ink: '#12392B',
  deep: '#0B4736',
  soft: '#4B6B5D',
  faint: '#5E7A6F',
  leaf: '#53A246',
  leafTint: '#E3F1DC',
  line: '#E1EADC',
  amber: '#A86300',
  rain: '#2A72B5',
  white: '#FFFFFF',
} as const;

/** A flat white card with a soft shadow. Pass `bg` for a coloured card (alerts). */
export function Panel({ children, style, bg }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; bg?: string }) {
  return <View style={[styles.panel, bg ? { backgroundColor: bg } : null, style]}>{children}</View>;
}

const ICONS: Record<WxIcon, { name: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string }> = {
  sun: { name: 'weather-sunny', color: '#F0A21A' },
  moon: { name: 'weather-night', color: '#7C8FB8' },
  partly: { name: 'weather-partly-cloudy', color: '#D9A441' },
  cloud: { name: 'weather-cloudy', color: '#8FA0B3' },
  rain: { name: 'weather-rainy', color: '#4B8FD0' },
  snow: { name: 'weather-snowy-heavy', color: '#6FA8D8' },
  fog: { name: 'weather-fog', color: '#9AA7B5' },
  storm: { name: 'weather-lightning-rainy', color: '#D9A441' },
};
export function WxPicture({ icon, size = 24 }: { icon: WxIcon; size?: number }) {
  const i = ICONS[icon] ?? ICONS.cloud;
  return <MaterialCommunityIcons name={i.name} size={size} color={i.color} />;
}

/** The page behind every Weather screen: the soft off-white the hero artwork dissolves into. */
export function WeatherBackground() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: WX.page }]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: WX.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: WX.line,
    shadowColor: '#14803C',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
