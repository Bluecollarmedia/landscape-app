/**
 * The Snow worker's Route tab. Until the worker has clocked in for a dispatched storm they see ONE screen with ONE button (Clock In);
 * their route and stops stay hidden. Once the database confirms the clock-in, this gives way to the normal Route screen with a quiet
 * "Clocked in since ..." line at the top. Clocking out lives only in the Time Clock tab; when the worker comes back to Route after
 * clocking out, the Clock In screen is back. If they are not on a dispatched route there is nothing to clock in for, so no button.
 * The state comes from the database's clock (useSnowClock), so it survives leaving the tab and reopening the app.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, LoadingSpinner } from '@/components/ui';
import { MyRouteScreen } from '@/components/snow/routes/MyRouteScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useSnowClock } from '@/hooks/useSnowClock';
import { loadMyRoutes } from '@/data/snowRoutes';
import { pickActiveRoute, splitMyRoutes } from '@/lib/snowMyRoute';
import { clockGateState, clockInErrorText, stormRouteLine } from '@/lib/snowClockView';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

export function SnowClockGate() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { open, allowed, loading, busy, clockInNow } = useSnowClock();
  const state = clockGateState({ loading, clockedIn: !!open, allowed });
  const [error, setError] = useState('');
  const [routeLine, setRouteLine] = useState('');

  // The storm and route they are clocking in for, from their real assignment.
  useEffect(() => {
    if (state !== 'ready') return;
    let alive = true;
    loadMyRoutes().then((res) => {
      if (!alive || !res.ok) return;
      const { active } = splitMyRoutes(res.data);
      const current = active.find((r) => r.id === pickActiveRoute(active, null));
      setRouteLine(current ? stormRouteLine(current.stormName, current.name) : '');
    });
    return () => { alive = false; };
  }, [state]);

  // Coming from the Clock In screen, the Route screen fades in and slides up a little (about 0.3 s). Reopening the app does not animate.
  const sawClockIn = useRef(false);
  const reveal = useRef(new Animated.Value(1)).current;
  useLayoutEffect(() => {
    if (state === 'ready') sawClockIn.current = true;
    if (state === 'route' && sawClockIn.current) {
      sawClockIn.current = false;
      reveal.setValue(0);
      Animated.timing(reveal, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [state, reveal]);

  async function clockIn() {
    setError('');
    const failed = await clockInNow();
    if (failed) setError(clockInErrorText(failed));
  }

  if (state === 'loading') {
    return <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}><LoadingSpinner /></View>;
  }

  if (state === 'route' && open) {
    return (
      <Animated.View style={{ flex: 1, opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <MyRouteScreen clockedInSince={open.clockInAt} />
      </Animated.View>
    );
  }

  if (state === 'none') {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.groupedBackground, paddingBottom: tabBarClearance }]}>
        <View style={[styles.snowCircle, { backgroundColor: colors.primarySurface }]}>
          <Icon name="cloud-snow" size={40} color={colors.primary} />
        </View>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.xl }]}>No active storm assignment</Text>
        <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, maxWidth: 320 }]}>
          Clock In appears once the owner puts you on a route for a storm that has been dispatched.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground, paddingTop: insets.top + spacing.xl, paddingBottom: tabBarClearance, paddingHorizontal: spacing.lg }]}>
      <Text style={[typeScale.labelLarge, { color: colors.primary }]}>Snow Mode</Text>
      <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.sm }]}>Ready to start?</Text>
      <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: spacing.sm }]}>Your hours start counting when you tap Clock In.</Text>
      {routeLine ? <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg }]} numberOfLines={2}>{routeLine}</Text> : null}

      <View style={styles.middle}>
        {error ? (
          <View style={styles.errorRow} accessibilityRole="alert">
            <Icon name="alert-circle" size={18} color={colors.error} />
            <Text style={[typeScale.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={clockIn}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Clocking in' : 'Clock In'}
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => [styles.clockButton, { backgroundColor: pressed ? colors.primaryDark : colors.primary, opacity: busy ? 0.85 : 1 }]}
        >
          {busy ? <ActivityIndicator color={colors.textOnPrimary} /> : <Icon name="clock" size={28} color={colors.textOnPrimary} />}
          <Text style={[typeScale.headingLarge, { color: colors.textOnPrimary }]}>{busy ? 'Clocking In…' : 'Clock In'}</Text>
        </Pressable>
        <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.lg }]}>
          No location is used. Snow hours are kept apart from landscaping hours.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  snowCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  clockButton: { height: 80, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, width: '100%' },
});
