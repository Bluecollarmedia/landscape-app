/**
 * MenuGroup / MenuRow — rounded, raised groups of tappable rows used on
 * the owner's More tab.
 *
 * Each row has a green IconTile, a label, an optional count badge and a
 * chevron. Rows highlight and shrink a touch while pressed.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, interpolateColor } from 'react-native-reanimated';
import { Icon } from './Icon';
import { IconTile } from './IconTile';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MenuGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <View style={styles.section}>
      {!!title && (
        <Text style={[typeScale.overline, styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      )}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        <View style={styles.groupClip}>
          {rows.map((row, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />}
              {row}
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

interface MenuRowProps {
  icon: string;
  label: string;
  subtitle?: string;
  /** Shows a green count pill when > 0. */
  count?: number;
  onPress: () => void;
}

export function MenuRow({ icon, label, subtitle, count, onPress }: MenuRowProps) {
  const { colors } = useTheme();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.015 }],
    backgroundColor: interpolateColor(pressed.value, [0, 1], [colors.surface, colors.primarySurface]),
  }));

  return (
    <AnimatedPressable
      style={[styles.row, animatedStyle]}
      onPressIn={() => { pressed.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { pressed.value = withSpring(0, { damping: 20, stiffness: 240 }); }}
      onPress={() => { haptics.select(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconTile name={icon} />
      <View style={styles.rowText}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{label}</Text>
        {!!subtitle && (
          <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      {!!count && count > 0 && (
        <View style={[styles.count, { backgroundColor: colors.primaryDark }]}>
          <Text style={[typeScale.caption, styles.countText]}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
      <Icon name="chevron-right" size={17} color={colors.textTertiary} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    paddingHorizontal: spacing.lg + spacing.lg,
    marginBottom: spacing.sm,
  },
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg + 2,
    ...Platform.select({
      android: { elevation: 2 },
      default: {
        shadowColor: '#1B3A2D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
    }),
  },
  groupClip: { borderRadius: radius.lg + 2, overflow: 'hidden' },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + 36 + spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.md,
  },
  rowText: { flex: 1 },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFFFFF', fontWeight: '700' },
});
