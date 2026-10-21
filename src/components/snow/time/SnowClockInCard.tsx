/**
 * The top of a Snow worker's Route page: "Clock in for the storm" while they are not clocked in, and a one-line "Clocked in since..." once
 * they are. It never shows a Clock Out button: clocking out lives in the Time Clock tab only, so there is one place to stop. It shows
 * nothing when the worker cannot clock in (not on a route in a dispatched storm).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Icon } from '@/components/ui';
import { showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { useSnowClock } from '@/hooks/useSnowClock';
import { formatClock } from '@/data/snowShifts';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

export function SnowClockInCard() {
  const { colors } = useTheme();
  const { open, allowed, loading, busy, clockInNow } = useSnowClock();
  if (loading) return null;

  if (open) {
    return (
      <View style={[styles.card, styles.row, { backgroundColor: colors.primarySurface }]} accessible accessibilityLabel={`Clocked in since ${formatClock(open.clockInAt)}. Clock out in the Time Clock tab.`}>
        <Icon name="clock" size={18} color={colors.primary} />
        <Text style={[typeScale.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>
          Clocked in since {formatClock(open.clockInAt)}. Clock out in the Time Clock tab.
        </Text>
      </View>
    );
  }

  if (!allowed) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, gap: spacing.sm }]}>
      <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>Clock in for the storm</Text>
      <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Tap when you start. Your hours count from now.</Text>
      <Button
        title="Clock In"
        icon="log-in"
        loading={busy}
        onPress={async () => { const err = await clockInNow(); if (err) showMessage("Couldn't clock in", err); }}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
