/**
 * The building blocks of the Brighton Weather screens: the light palette (white air and tints of the logo's leaf green, text in the logo's deep
 * green), the flat white cards, the weather pictures and a small helper for the page behind everything. Flat and solid on purpose: no blur, no
 * see-through panels. Used only by the Weather screens.
 */
import React from 'react';
import { Image, Platform, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
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

let SymbolView: any = null;
try { SymbolView = require('expo-symbols').SymbolView; } catch { /* no symbols on this platform: the drawn pictures are used */ }

/** Apple's own weather symbols (SF Symbols, the set the iPhone Weather app draws from), in their multicolor form. iPhone only. */
const SYMBOLS: Record<WxIcon | 'sunrise' | 'sunset', string> = {
  sun: 'sun.max.fill',
  moon: 'moon.stars.fill',
  partly: 'cloud.sun.fill',
  cloud: 'cloud.fill',
  rain: 'cloud.rain.fill',
  snow: 'cloud.snow.fill',
  fog: 'cloud.fog.fill',
  storm: 'cloud.bolt.rain.fill',
  sunrise: 'sunrise.fill',
  sunset: 'sunset.fill',
};

/** The fallback weather pictures: soft, flat drawings (assets/images/wx), used where Apple's symbols are not available (web, Android). */
const PICTURES: Record<WxIcon | 'sunrise' | 'sunset', ImageSourcePropType> = {
  sun: require('../../../assets/images/wx/sun.png'),
  moon: require('../../../assets/images/wx/moon.png'),
  partly: require('../../../assets/images/wx/partly.png'),
  cloud: require('../../../assets/images/wx/cloud.png'),
  rain: require('../../../assets/images/wx/rain.png'),
  snow: require('../../../assets/images/wx/snow.png'),
  fog: require('../../../assets/images/wx/fog.png'),
  storm: require('../../../assets/images/wx/storm.png'),
  sunrise: require('../../../assets/images/wx/sunrise.png'),
  sunset: require('../../../assets/images/wx/sunset.png'),
};
export function WxPicture({ icon, size = 24 }: { icon: WxIcon | 'sunrise' | 'sunset'; size?: number }) {
  const drawn = <Image source={PICTURES[icon] ?? PICTURES.cloud} style={{ width: size, height: size }} resizeMode="contain" accessible={false} />;
  if (Platform.OS === 'ios' && SymbolView) {
    return (
      <SymbolView
        name={SYMBOLS[icon] ?? SYMBOLS.cloud}
        type="multicolor"
        size={size}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
        fallback={drawn}
        accessible={false}
      />
    );
  }
  return drawn;
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
