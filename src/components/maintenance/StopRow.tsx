import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { formatClock, servicesLabel } from './format';
import type { RouteStopView, StopDisplayStatus } from './types';

const STATUS_LABEL: Record<StopDisplayStatus, string> = {
  upcoming: 'Upcoming',
  next: 'Up next',
  arrived: 'On site',
  completed: 'Done',
  skipped: 'Skipped',
};

export function StopStatusPill({ status }: { status: StopDisplayStatus }) {
  const { colors } = useTheme();
  const tone =
    status === 'next' || status === 'arrived'
      ? { bg: colors.primarySurface, fg: colors.primaryDark }
      : status === 'completed'
        ? { bg: colors.successLight, fg: colors.success }
        : { bg: colors.backgroundTertiary, fg: colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[typeScale.labelSmall, { color: tone.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

interface StopRowProps {
  stop: RouteStopView;
  first?: boolean;
  /** Show the visit's instructions inline (Today shows them for the current stop only). */
  showInstructions?: boolean;
  onPress?: () => void;
}

/** One numbered stop in route order, as in the "Upcoming Stops" list. */
export function StopRow({ stop, first, showInstructions, onPress }: StopRowProps) {
  const { colors } = useTheme();
  const active = stop.status === 'next' || stop.status === 'arrived';
  const done = stop.status === 'completed';
  const muted = done || stop.status === 'skipped';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed && { backgroundColor: colors.surfacePressed },
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Stop ${stop.position}, ${stop.propertyName}, ${STATUS_LABEL[stop.status]}`}
    >
      <View
        style={[
          styles.number,
          { backgroundColor: active ? colors.primaryDark : done ? colors.primary : colors.border },
        ]}
      >
        {done ? (
          <Feather name="check" size={16} color="#FFFFFF" />
        ) : (
          <Text style={[typeScale.labelLarge, { color: active ? '#FFFFFF' : colors.textSecondary }]}>{stop.position}</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[typeScale.headingSmall, { color: muted ? colors.textSecondary : colors.textPrimary, flex: 1 }]}
            numberOfLines={1}
          >
            {stop.propertyName}
          </Text>
          <StopStatusPill status={stop.status} />
        </View>
        <View style={styles.meta}>
          <Feather name="map-pin" size={13} color={colors.textTertiary} />
          <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {stop.address}
          </Text>
        </View>
        <View style={styles.meta}>
          <Feather name="scissors" size={13} color={colors.primary} />
          <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textSecondary }]} numberOfLines={2}>
            {servicesLabel(stop.services)}
          </Text>
        </View>
        {done && stop.completedAt && (
          <View style={styles.meta}>
            <Feather name="check-circle" size={13} color={colors.success} />
            <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              Finished {formatClock(stop.completedAt)}{stop.completedByName ? ` by ${stop.completedByName}` : ''}
            </Text>
          </View>
        )}
        {showInstructions && stop.instructions ? (
          <View style={[styles.note, { backgroundColor: colors.primarySurface }]}>
            <Feather name="info" size={13} color={colors.primaryDark} />
            <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textPrimary }]}>{stop.instructions}</Text>
          </View>
        ) : null}
      </View>

      {onPress && <Feather name="chevron-right" size={18} color={colors.textTertiary} style={styles.chevron} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  number: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  body: { flex: 1, marginLeft: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { marginLeft: spacing.xs, flexShrink: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  chevron: { marginLeft: spacing.xs, marginTop: 8 },
});
