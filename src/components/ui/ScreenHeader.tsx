/**
 * ScreenHeader — the top of a pushed owner screen (Trucks, Join
 * Requests, Notifications, ...).
 *
 * A Liquid Glass back button on the left (the same glass material as
 * the Schedule tab's Day/Week control), optional buttons on the right,
 * then a large title and subtitle underneath. Also exports the two
 * header buttons so screens can use them on their own.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { brand } from '@/theme/colors';

const HAS_LIQUID_GLASS = isLiquidGlassAvailable();
const BUTTON_SIZE = 44;

interface GlassIconButtonProps {
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** Round glass button. Real Liquid Glass on iOS 26, a frosted chip elsewhere. */
export function GlassIconButton({ icon, onPress, accessibilityLabel, style }: GlassIconButtonProps) {
  const { colors } = useTheme();
  const glyph = <Icon name={icon as any} size={22} color={colors.textPrimary} />;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {HAS_LIQUID_GLASS ? (
        <GlassView glassEffectStyle="regular" isInteractive style={styles.glassButton}>
          {glyph}
        </GlassView>
      ) : (
        <View
          style={[
            styles.glassButton,
            styles.frosted,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
        >
          {glyph}
        </View>
      )}
    </PressableScale>
  );
}

interface RaisedAddButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  icon?: string;
}

/** The raised green + button: gradient, glossy top, springs when tapped. */
export function RaisedAddButton({ onPress, accessibilityLabel, icon = 'plus' }: RaisedAddButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.88}
      haptic="light"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.raisedShadow}
    >
      <LinearGradient
        colors={['#66BB6A', brand.primaryDark]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.raisedButton}
      >
        <View style={styles.raisedHighlight} />
        <Icon name={icon as any} size={22} color="#FFFFFF" />
      </LinearGradient>
    </PressableScale>
  );
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Buttons shown top-right (e.g. a RaisedAddButton). */
  right?: React.ReactNode;
  /** Override the back action (defaults to router.back()). */
  onBack?: () => void;
}

export function ScreenHeader({ title, subtitle, right, onBack }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.buttonRow}>
        <GlassIconButton
          icon="chevron-left"
          onPress={onBack ?? (() => router.back())}
          accessibilityLabel="Go back"
        />
        <View style={styles.right}>{right}</View>
      </View>
      <Animated.View entering={FadeIn.duration(260)}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  glassButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  frosted: {
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      android: { elevation: 3 },
      default: {
        shadowColor: '#1B3A2D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
    }),
  },
  raisedShadow: Platform.select({
    android: { elevation: 6, borderRadius: BUTTON_SIZE / 2 },
    default: {
      borderRadius: BUTTON_SIZE / 2,
      shadowColor: brand.primaryDark,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
    },
  })!,
  raisedButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  raisedHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
