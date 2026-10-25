import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { ServiceIcon } from '@/components/maintenance/ServiceIcon';
import { servicesLabel, stopAddress, formatClock } from '@/components/maintenance/format';
import { crewStopMessage } from '@/lib/maintenanceLeader';
import { useFinishingStop, missingRequirements } from '@/data/maintenanceFinish';
import { db } from '@/data/store';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { useT } from '@/i18n';
import type { MaintenanceRouteDetail, MaintenanceStopDetail } from '@/types/maintenance';

export type StopCardState = 'done' | 'next' | 'later';

interface Props {
  stop: MaintenanceStopDetail;
  route: MaintenanceRouteDetail;
  state: StopCardState;
  leader: boolean;
  starting?: boolean;
  onOpen: () => void;
  onArrive: () => void;
  onFinish: () => void;
  onDirections: () => void;
}

/**
 * One stop on the worker's Today. Finished stops are a calm collapsed row, later stops are quiet, and only the next one is a big card
 * with ONE action (I'M HERE, then FINISH STOP) for the route's leader. Everyone else sees where the crew is. The address opens Maps.
 * Everything inside a stop (checklist, photos, instructions, access notes) stays on the stop's own screen.
 */
export function StopCard({ stop, route, state, leader, starting, onOpen, onArrive, onFinish, onDirections }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const finishing = useFinishingStop(stop.id);
  const name = stop.property?.name ?? t('Property');
  const address = stopAddress(stop);
  const service = servicesLabel(stop);
  const skipped = stop.status === 'skipped';

  if (state === 'done') {
    return (
      <Pressable onPress={onOpen} accessibilityRole="button" style={[styles.row, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[styles.check, { backgroundColor: skipped ? colors.backgroundTertiary : colors.success }]}>
          <Feather name={skipped ? 'minus' : 'check'} size={14} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]} numberOfLines={1}>{name}</Text>
          <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>{skipped ? t('Skipped') : address}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textTertiary} />
      </Pressable>
    );
  }

  const number = stop.number;
  if (state === 'later') {
    return (
      <Pressable onPress={onOpen} accessibilityRole="button" style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
        <View style={[styles.num, { backgroundColor: colors.backgroundTertiary }]}><Text style={[typeScale.labelLarge, { color: colors.textSecondary }]}>{number}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{address}</Text>
          <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>{service}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textTertiary} />
      </Pressable>
    );
  }

  // The next stop.
  const blockers = stop.status === 'arrived' ? missingRequirements(stop) : [];
  const arrivedBy = stop.arrivedBy ? db.people[stop.arrivedBy]?.firstName : undefined;
  const leaderName = route.lead ? `${route.lead.firstName} ${route.lead.lastName}`.trim() : undefined;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, shadow.md]}>
      <Pressable onPress={onOpen} accessibilityRole="button">
        <View style={styles.titleRow}>
          <View style={[styles.numBig, { backgroundColor: colors.primaryDark }]}><Text style={[typeScale.headingSmall, { color: '#FFFFFF' }]}>{number}</Text></View>
          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]} numberOfLines={2}>{name}</Text>
        </View>
      </Pressable>
      <Pressable onPress={onDirections} accessibilityRole="link" accessibilityLabel={`${t('Open in Maps')}: ${address}`} hitSlop={6} style={styles.meta}>
        <Feather name="map-pin" size={15} color={colors.primary} />
        <Text style={[typeScale.bodyMedium, { color: colors.primary, flex: 1, textDecorationLine: 'underline' }]} numberOfLines={2}>{address}</Text>
      </Pressable>
      <View style={styles.meta}>
        <ServiceIcon label={service} size={15} color={colors.textSecondary} />
        <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, flex: 1 }]} numberOfLines={2}>{service}</Text>
      </View>
      {stop.status === 'arrived' && stop.arrivedAt ? (
        <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          {arrivedBy ? t('Checked in {time} by {name}', { time: formatClock(stop.arrivedAt), name: arrivedBy }) : t('Checked in {time}', { time: formatClock(stop.arrivedAt) })}
        </Text>
      ) : null}

      {leader ? (
        stop.status === 'pending' ? (
          <Pressable onPress={onArrive} disabled={starting} accessibilityRole="button" accessibilityLabel={t("I'm here at {name}", { name })}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primaryDark, opacity: starting ? 0.6 : pressed ? 0.9 : 1 }]}>
            <Feather name="navigation" size={18} color="#FFFFFF" />
            <Text style={[typeScale.labelLarge, styles.buttonText]}>{starting ? t('Finding your location…') : t("I'M HERE")}</Text>
          </Pressable>
        ) : stop.status === 'arrived' ? (
          <Pressable onPress={onFinish} disabled={finishing} accessibilityRole="button" accessibilityLabel={t('Finish stop')}
            style={({ pressed }) => [styles.button, { backgroundColor: blockers.length ? colors.primary : colors.primaryDark, opacity: finishing ? 0.6 : pressed ? 0.9 : 1 }]}>
            <Feather name="check-circle" size={18} color="#FFFFFF" />
            <Text style={[typeScale.labelLarge, styles.buttonText]}>{finishing ? t('Saving…') : blockers.length ? `${t('FINISH STOP')} · ${blockers[0]}${blockers.length > 1 ? ` +${blockers.length - 1}` : ''}` : t('FINISH STOP')}</Text>
          </Pressable>
        ) : null
      ) : (
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.md }]}>
          {crewStopMessage(stop.status, leaderName, stop.arrivedAt ? formatClock(stop.arrivedAt) : null, arrivedBy, !!leaderName)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  numBig: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  button: { height: 58, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.md },
  buttonText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
