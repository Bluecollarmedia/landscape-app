/**
 * The building blocks of the Brighton Weather screens: the scene behind everything, floating "liquid glass" cards, the weather pictures and a
 * gentle float. On an iPhone with Liquid Glass (iOS 26) the glass is Apple's own (GlassView); on anything older it is a translucent, lit panel.
 * Used only by the Weather screens.
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { WxIcon } from '@/lib/weatherView';

const HAS_GLASS = isLiquidGlassAvailable();

/** A card of translucent glass that floats above the scene. */
export function GlassCard({ children, style, light = false, solid = false }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; light?: boolean; solid?: boolean }) {
  if (HAS_GLASS) {
    return <GlassView glassEffectStyle="regular" style={[styles.card, style]}>{children}</GlassView>;
  }
  return (
    <View style={[styles.card, styles.cardShadow, style]}>
      <LinearGradient
        colors={solid ? ['rgba(28,66,46,0.92)', 'rgba(20,50,35,0.88)'] : light ? ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)'] : ['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.cardEdge]}
      />
      <LinearGradient colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** Drifts a few points up and down, each element at its own pace. Still when the phone says to reduce motion. */
export function Floaty({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const y = useSharedValue(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined); }, []);
  useEffect(() => {
    if (reduce) { y.value = 0; return; }
    y.value = withDelay(delay, withRepeat(withSequence(withTiming(-3, { duration: 3600, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 3600, easing: Easing.inOut(Easing.sin) })), -1));
  }, [reduce, delay, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

const ICONS: Record<WxIcon, { name: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string }> = {
  sun: { name: 'weather-sunny', color: '#F4B63F' },
  moon: { name: 'weather-night', color: '#C9D6F2' },
  partly: { name: 'weather-partly-cloudy', color: '#E8D9A8' },
  cloud: { name: 'weather-cloudy', color: '#C4CDD6' },
  rain: { name: 'weather-rainy', color: '#8EC3F0' },
  snow: { name: 'weather-snowy-heavy', color: '#E4F2FF' },
  fog: { name: 'weather-fog', color: '#C4CDD6' },
  storm: { name: 'weather-lightning-rainy', color: '#F2D27A' },
};
export function WxPicture({ icon, size = 24 }: { icon: WxIcon; size?: number }) {
  const i = ICONS[icon] ?? ICONS.cloud;
  return <MaterialCommunityIcons name={i.name} size={size} color={i.color} />;
}

function Pine({ x, bottom, w, h, color, opacity }: { x: number; bottom: number; w: number; h: number; color: string; opacity: number }) {
  // A tree drawn from stacked triangles (the border trick), so no drawing library is needed.
  const tiers = [0, 1, 2];
  return (
    <View style={{ position: 'absolute', left: x, bottom, width: w, height: h, alignItems: 'center', opacity }} pointerEvents="none">
      {tiers.map((t) => {
        const tw = w * (0.55 + t * 0.22);
        const th = h * 0.42;
        return <View key={t} style={{ position: 'absolute', top: t * h * 0.2, width: 0, height: 0, borderLeftWidth: tw / 2, borderRightWidth: tw / 2, borderBottomWidth: th, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />;
      })}
      <View style={{ position: 'absolute', bottom: 0, width: w * 0.12, height: h * 0.16, backgroundColor: color }} />
    </View>
  );
}

/** The scene behind every Weather screen: a misty green forest, drawn (no photograph). */
export function WeatherBackground({ night = false }: { night?: boolean }) {
  const sky = night ? ['#0b1b33', '#123a63', '#1c5b8a', '#12301f'] : ['#86ad8f', '#6c9876', '#4a7a58', '#2c553b', '#12301f'];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={sky as [string, string, ...string[]]} locations={night ? [0, 0.35, 0.65, 1] : [0, 0.22, 0.48, 0.74, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 30, right: -50, width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(255,248,205,0.2)' }} />
      <View style={{ position: 'absolute', top: 66, right: -14, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,248,205,0.28)' }} />
      <Pine x={-24} bottom={380} w={96} h={250} color="#1b4430" opacity={0.7} />
      <Pine x={38} bottom={350} w={80} h={210} color="#1b4430" opacity={0.55} />
      <Pine x={250} bottom={390} w={100} h={260} color="#1b4430" opacity={0.75} />
      <Pine x={210} bottom={340} w={80} h={200} color="#1b4430" opacity={0.5} />
      <Pine x={-46} bottom={200} w={120} h={330} color="#0f2c1d" opacity={0.9} />
      <Pine x={290} bottom={190} w={120} h={330} color="#0f2c1d" opacity={0.9} />
      <LinearGradient colors={['rgba(10,28,18,0)', 'rgba(10,28,18,0.6)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden' },
  cardShadow: { shadowColor: '#06160e', shadowOpacity: 0.38, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  cardEdge: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.46)' },
});
