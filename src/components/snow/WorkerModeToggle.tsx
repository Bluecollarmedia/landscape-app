import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useModeAccess } from '@/hooks/useModeAccess';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme/spacing';

const HAS_LIQUID_GLASS = isLiquidGlassAvailable();
const HEIGHT = 38;
/** The strip at the top of the screen that belongs to the toggle. The app's screens start below it, so it never covers anything. */
export const WORKER_TOGGLE_BAND = HEIGHT + 8;

/**
 * A small liquid-glass switch in the top-right corner of every worker's phone while the owner has Snow Mode on: sun = Landscaping,
 * snowflake = Snow. It puts the worker into Snow Mode (no sign-up, no code) and lets them step back to their landscaping work.
 * A worker the owner removed from snow gets nothing here (they see the "Snow Mode is on" screen instead).
 * It has its own strip under the status bar (WORKER_TOGGLE_BAND): the root layout moves every screen's top edge below that strip.
 */
export function WorkerModeToggle() {
  const { user, appState, isAuthenticated } = useAuth();
  const { shell, canToggle, setChoice } = useModeAccess(user?.role);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (!isAuthenticated || appState !== 'active' || !canToggle) return null;

  const inSnow = shell === 'snow';
  const Segment = ({ on, icon, label, onPress }: { on: boolean; icon: 'sun' | 'cloud-snow'; label: string; onPress: () => void }) => (
    <PressableScale
      onPress={() => { if (!on) { haptics.select(); onPress(); } }}
      scaleTo={0.92}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={[styles.segment, on && { backgroundColor: colors.primary }]}
    >
      <Icon name={icon} size={17} color={on ? '#FFFFFF' : colors.textSecondary} />
    </PressableScale>
  );
  const row = (
    <View style={styles.row}>
      <Segment on={!inSnow} icon="sun" label="Landscaping Mode" onPress={() => setChoice('landscaping')} />
      <Segment on={inSnow} icon="cloud-snow" label="Snow Mode" onPress={() => setChoice('snow')} />
    </View>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 4, right: spacing.md }]}>
      {HAS_LIQUID_GLASS ? (
        <GlassView glassEffectStyle="regular" isInteractive style={styles.pill}>{row}</GlassView>
      ) : (
        <View style={[styles.pill, styles.frosted, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>{row}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', zIndex: 1000, elevation: 20 },
  pill: { height: HEIGHT, borderRadius: HEIGHT / 2, overflow: 'hidden', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 3, gap: 2 },
  segment: { width: 36, height: HEIGHT - 6, borderRadius: (HEIGHT - 6) / 2, alignItems: 'center', justifyContent: 'center' },
  frosted: {
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
    }),
  },
});
