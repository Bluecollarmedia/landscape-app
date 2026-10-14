/**
 * IconTile — a raised, rounded-square brand-green icon.
 *
 * Replaces the pale green circles used in menus with a solid tile that
 * has a light-to-dark green gradient, a soft top highlight and a drop
 * shadow, so icons read as something you can press instead of a flat
 * decoration. Every tile is the same Brighton green on purpose.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import { brand } from '@/theme/colors';

const TILE_GRADIENT = ['#66BB6A', brand.primaryDark] as const;

interface IconTileProps {
  name: string;
  /** Tile edge length. The icon scales with it. */
  size?: number;
  /** Greyed-out look for disabled/off items. */
  muted?: boolean;
}

export function IconTile({ name, size = 36, muted }: IconTileProps) {
  const radius = Math.round(size * 0.3);
  return (
    <View style={[styles.shadow, { width: size, height: size, borderRadius: radius }, muted && styles.mutedShadow]}>
      <LinearGradient
        colors={muted ? ['#C7CCC8', '#9EA6A0'] : TILE_GRADIENT}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.tile, { borderRadius: radius }]}
      >
        <View style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
        <Icon name={name as any} size={Math.round(size * 0.5)} color="#FFFFFF" />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: Platform.select({
    android: { elevation: 3 },
    default: {
      shadowColor: brand.primaryDark,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
    },
  })!,
  mutedShadow: { shadowOpacity: 0.1, elevation: 1 },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
