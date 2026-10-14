/**
 * Settings building blocks — grouped cards with solid colored icon tiles
 * (like iOS Settings) and rows that spring when pressed, so the owner's
 * Settings screen feels alive instead of a flat list of text rows.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow, sizing } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';

type IconName = keyof typeof Feather.glyphMap;

/** Saturated tile colors, one per kind of setting, so each row is easy to spot. */
export const tileColors = {
  green: '#34A853',
  teal: '#14A38B',
  blue: '#2F80ED',
  indigo: '#5B5BD6',
  orange: '#F2994A',
  pink: '#E0457B',
  gray: '#8E8E93',
  red: '#E5484D',
} as const;

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

interface PressScaleProps {
  onPress?: () => void;
  disabled?: boolean;
  /** How far the content shrinks while held. */
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
}

/** Wraps anything tappable in a quick spring-scale press, with a light haptic. */
export function PressScale({ onPress, disabled, pressedScale = 0.97, style, children, accessibilityLabel }: PressScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      onPressIn={() => { scale.value = withSpring(pressedScale, SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING); }}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** A rounded colored square holding a white icon. */
export function IconTile({ name, color, size = 30 }: { name: IconName; color: string; size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: color }]}>
      <Icon name={name} size={size * 0.55} color="#FFFFFF" />
    </View>
  );
}

interface SettingsGroupProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}

export function SettingsGroup({ title, footer, children }: SettingsGroupProps) {
  const { colors } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.group}>
      {title && (
        <Text style={[typeScale.labelSmall, styles.groupTitle, { color: colors.textSecondary }]}>
          {title}
        </Text>
      )}
      <View style={[styles.card, { backgroundColor: colors.surface }, shadow.sm]}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {child}
            {i < items.length - 1 && <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
          </React.Fragment>
        ))}
      </View>
      {footer && (
        <Text style={[typeScale.caption, styles.footer, { color: colors.textTertiary }]}>{footer}</Text>
      )}
    </View>
  );
}

interface SettingsRowProps {
  icon?: IconName;
  tint?: string;
  title: string;
  subtitle?: string;
  value?: string;
  selected?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  /** Extra content under the title (e.g. a usage bar). */
  children?: React.ReactNode;
}

export function SettingsRow({ icon, tint = tileColors.green, title, subtitle, value, selected, destructive, onPress, children }: SettingsRowProps) {
  const { colors } = useTheme();
  const titleColor = destructive ? tileColors.red : colors.textPrimary;

  return (
    <PressScale onPress={onPress} pressedScale={0.98} style={styles.row} accessibilityLabel={title}>
      {icon && <IconTile name={icon} color={destructive ? tileColors.red : tint} />}
      <View style={styles.rowText}>
        <Text style={[typeScale.bodyLarge, { color: titleColor, fontWeight: '600' }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 1 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
        {children}
      </View>
      {value && (
        <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, maxWidth: '45%' }]} numberOfLines={1}>
          {value}
        </Text>
      )}
      {selected && <Icon name="check" size={18} color={colors.primary} />}
      {onPress && !selected && !destructive && (
        <View style={[styles.chevron, { backgroundColor: colors.backgroundTertiary }]}>
          <Icon name="chevron-right" size={14} color={colors.textTertiary} />
        </View>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.xl },
  groupTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  footer: { marginTop: spacing.sm, marginHorizontal: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md + 30 + spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: sizing.touchTarget + 8,
    gap: spacing.md,
  },
  rowText: { flex: 1 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  chevron: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** A thin usage bar that grows to its value when it appears or changes. */
export function UsageBar({ percent, color, height = 6 }: { percent: number; color: string; height?: number }) {
  const { colors } = useTheme();
  const width = useSharedValue(0);
  React.useEffect(() => {
    width.value = withSpring(Math.max(0, Math.min(100, percent)), { damping: 20, stiffness: 120 });
  }, [percent, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.backgroundTertiary, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fill]} />
    </View>
  );
}
