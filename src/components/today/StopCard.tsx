import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { ServiceIcon } from '@/components/maintenance/ServiceIcon';
import { StopChecklist } from '@/components/maintenance/StopChecklist';
import { StopPhotos } from '@/components/maintenance/StopPhotos';
import { FinishStopButton } from '@/components/maintenance/FinishStopButton';
import { servicesLabel, stopAddress, formatClock } from '@/components/maintenance/format';
import { crewStopMessage } from '@/lib/maintenanceLeader';
import { missingRequirements, uploadingPhotoCount } from '@/data/maintenanceFinish';
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
 * One stop on the worker's Today. Finished stops are a calm collapsed row, later stops are quiet, and only the next one is a big card.
 *
 * The big card follows where the worker is:
 *  - DRIVING THERE (not checked in yet): name, address (opens Maps), the work, how many tasks, the way in (access notes), and I'M HERE
 *    for the route's leader. Everyone else sees where the crew is.
 *  - ON SITE (checked in): the card opens into the job itself: this visit's instructions, the checklist (anyone on the crew ticks),
 *    the photos, and FINISH STOP (leader) greyed out with the "Before you finish" list until everything required is done.
 * These are the SAME checklist, photo and finish components and rules as the stop screen; only where they appear changed.
 */
export function StopCard({ stop, route, state, leader, starting, onOpen, onArrive, onFinish, onDirections }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
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
  const onSite = stop.status === 'arrived';
  const required = stop.tasks.filter((task) => task.isRequired);
  const missing = onSite ? missingRequirements(stop) : [];
  const arrivedBy = stop.arrivedBy ? db.people[stop.arrivedBy]?.firstName : undefined;
  const leaderName = route.lead ? `${route.lead.firstName} ${route.lead.lastName}`.trim() : undefined;
  const taskCount = stop.tasks.length;
  const tasksLine = [
    taskCount === 0 ? null : taskCount === 1 ? t('1 task') : t('{n} tasks', { n: taskCount }),
    stop.requiresPhotos ? (stop.minPhotos === 1 ? t('1 photo needed') : t('{n} photos needed', { n: stop.minPhotos })) : null,
  ].filter(Boolean).join(' · ');
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
      {!onSite && tasksLine ? (
        <View style={styles.meta}>
          <Feather name="check-square" size={15} color={colors.textSecondary} />
          <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, flex: 1 }]}>{tasksLine}</Text>
        </View>
      ) : null}
      {stop.property?.accessNotes ? (
        <View style={[styles.note, { backgroundColor: colors.backgroundSecondary }]}>
          <Feather name="key" size={14} color={colors.textSecondary} />
          <Text style={[typeScale.bodySmall, styles.noteText, { color: colors.textPrimary }]}>{stop.property.accessNotes}</Text>
        </View>
      ) : null}
      {onSite && stop.arrivedAt ? (
        <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          {arrivedBy ? t('Checked in {time} by {name}', { time: formatClock(stop.arrivedAt), name: arrivedBy }) : t('Checked in {time}', { time: formatClock(stop.arrivedAt) })}
        </Text>
      ) : null}

      {/* ON SITE: the job itself, right here. */}
      {onSite ? (
        <>
          {stop.instructions ? (
            <View style={[styles.note, { backgroundColor: colors.warningLight }]}>
              <Feather name="alert-circle" size={14} color={colors.warning} />
              <Text style={[typeScale.bodySmall, styles.noteText, { color: colors.textPrimary }]}>{stop.instructions}</Text>
            </View>
          ) : null}
          {taskCount > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={[typeScale.overline, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                {required.length ? t('Checklist · {done} of {total} required', { done: required.filter((x) => x.completedAt).length, total: required.length }) : t('Checklist')}
              </Text>
              <StopChecklist tasks={stop.tasks} locked={false} stopId={stop.id} requiresPhotos={stop.requiresPhotos} photoCount={stop.photos.length} onError={setError} />
            </View>
          ) : null}
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typeScale.overline, { color: colors.textSecondary, marginBottom: spacing.sm }]}>{t('Photos')}</Text>
            <StopPhotos stopId={stop.id} photos={stop.photos} requiresPhotos={stop.requiresPhotos} minPhotos={stop.minPhotos} locked={false} />
          </View>
          {error ? <Text style={[typeScale.bodySmall, { color: colors.error, marginTop: spacing.sm }]}>{t(error)}</Text> : null}
        </>
      ) : null}

      {leader ? (
        !onSite && stop.status === 'pending' ? (
          <Pressable onPress={onArrive} disabled={starting} accessibilityRole="button" accessibilityLabel={t("I'm here at {name}", { name })}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primaryDark, opacity: starting ? 0.6 : pressed ? 0.9 : 1 }]}>
            <Feather name="navigation" size={18} color="#FFFFFF" />
            <Text style={[typeScale.labelLarge, styles.buttonText]}>{starting ? t('Finding your location…') : t("I'M HERE")}</Text>
          </Pressable>
        ) : onSite ? (
          <View style={{ marginTop: spacing.lg }}>
            <FinishStopButton stopId={stop.id} missing={missing} uploading={uploadingPhotoCount(stop)} onPress={() => { setError(null); onFinish(); }} />
          </View>
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
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.sm },
  noteText: { flex: 1 },
  button: { height: 58, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.md },
  buttonText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
