import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkers } from '@/hooks/useWorkers';
import { useSchedule } from '@/hooks/useSchedule';
import { useResources } from '@/hooks/useResources';
import { StatusBadge, Avatar, EmptyState } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { haptics } from '@/lib/haptics';
import { todayKey, localDateKey } from '@/lib/ids';

const today = todayKey();

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function formatTime(time?: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatHeaderDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatHiredDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const confirmLabel = (state: string) => {
  if (state === 'confirmed') return { label: 'Confirmed', status: 'success' as const };
  if (state === 'awaiting') return { label: 'Awaiting', status: 'warning' as const };
  if (state === 'updated_since') return { label: 'Updated', status: 'info' as const };
  return { label: 'Not Sent', status: 'neutral' as const };
};

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getWorker, updateWorker } = useWorkers({ includeInactive: true });
  const schedule = useSchedule();
  const { resourcesFor } = useResources();

  const worker = getWorker(id);

  if (!worker) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <EmptyState icon="alert-circle" title="Worker not found" description="This worker may have been removed." />
        </View>
      </View>
    );
  }

  const w = worker;
  const p = w.person;
  const isActive = w.member.status === 'active';

  const todayAssignments = schedule.getByWorker(p.id, today);
  const tomorrowAssignments = schedule.getByWorker(p.id, offsetDate(1));

  function handleCall() {
    if (!p.phone) return;
    Linking.openURL(`tel:${p.phone.replace(/[^\d+]/g, '')}`);
  }

  function handleEmail() {
    Linking.openURL(`mailto:${p.email}`);
  }

  function handleDeactivate() {
    const doDeactivate = () => {
      haptics.destructive();
      updateWorker(p.id, { status: 'inactive' });
      router.back();
    };
    const msg = `Deactivate ${p.firstName} ${p.lastName}? They will lose access but historical records will be preserved.`;
    if (Platform.OS === 'web') {
      if (confirm(msg)) doDeactivate();
    } else {
      Alert.alert(
        'Deactivate Worker',
        `${p.firstName} ${p.lastName} will lose access. Historical records (hours, payroll, attendance) will be preserved.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Deactivate', style: 'destructive', onPress: doDeactivate }],
      );
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          Worker Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Profile header */}
          <View style={[styles.profileCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <View style={styles.profileTopRow}>
              <Avatar firstName={p.firstName} lastName={p.lastName} size={72} uri={p.avatarUrl} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>
                  {p.firstName} {p.lastName}
                </Text>
                <View style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}>
                  <StatusBadge label={isActive ? 'Active' : 'Inactive'} status={isActive ? 'success' : 'error'} />
                </View>
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                  Worker · Hired {formatHiredDate(w.member.createdAt)}
                </Text>
              </View>
            </View>

            <View style={styles.contactRow}>
              <Pressable
                style={[styles.contactBtn, { backgroundColor: colors.primarySurface }, !p.phone && { opacity: 0.4 }]}
                onPress={handleCall}
                disabled={!p.phone}
              >
                <Icon name="phone" size={16} color={semantic.success} />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={[typeScale.labelSmall, { color: colors.textPrimary, fontWeight: '700' }]}>Call</Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{p.phone ?? '—'}</Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.contactBtn, { backgroundColor: colors.backgroundTertiary }]}
                onPress={handleEmail}
              >
                <Icon name="mail" size={16} color={colors.textSecondary} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typeScale.labelSmall, { color: colors.textPrimary, fontWeight: '700' }]}>Email</Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{p.email}</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Today */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary, fontWeight: '700' }]}>Today</Text>
              <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{formatHeaderDate(today)}</Text>
            </View>

            {todayAssignments.length > 0 ? (
              todayAssignments.map((a) => {
                const timeStr = a.isFullDay ? 'Full Day' : `${formatTime(a.startTime)} – ${formatTime(a.endTime)}`;
                const badge = confirmLabel(a.confirmationState);
                return (
                  <View key={a.id} style={[styles.assignmentBlock, { backgroundColor: colors.primarySurface }]}>
                    <View style={styles.assignmentTopRow}>
                      <View style={styles.assignmentDetailRow}>
                        <Icon name="map-pin" size={14} color={colors.textSecondary} />
                        <View style={{ marginLeft: spacing.xs }}>
                          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]}>{a.project?.name}</Text>
                          {a.project?.address && (
                            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{a.project.address}</Text>
                          )}
                        </View>
                      </View>
                      <StatusBadge label={badge.label} status={badge.status} />
                    </View>
                    <View style={styles.assignmentDetailRow}>
                      <Icon name="clock" size={14} color={colors.textSecondary} />
                      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>{timeStr}</Text>
                    </View>
                    <View style={styles.assignmentDetailRow}>
                      <Icon name="truck" size={14} color={colors.textSecondary} />
                      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                        {a.truck?.name ?? 'No truck assigned'}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                Not scheduled today
              </Text>
            )}

            <Pressable
              style={[styles.scheduleWorkBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/(owner)/schedule-create?workerId=${p.id}&date=${today}` as any)}
            >
              <Icon name="calendar" size={16} color={colors.textOnPrimary} />
              <Text style={[typeScale.labelLarge, { color: colors.textOnPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>
                Schedule Work
              </Text>
            </Pressable>
          </View>

          {/* Tomorrow */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary, fontWeight: '700' }]}>Tomorrow</Text>
              <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{formatHeaderDate(offsetDate(1))}</Text>
            </View>

            {tomorrowAssignments.length > 0 ? (
              tomorrowAssignments.map((a) => {
                const timeStr = a.isFullDay ? 'Full Day' : `${formatTime(a.startTime)} – ${formatTime(a.endTime)}`;
                return (
                  <View key={a.id} style={{ marginTop: spacing.xs }}>
                    <View style={styles.assignmentDetailRow}>
                      <Icon name="map-pin" size={14} color={colors.textSecondary} />
                      <View style={{ marginLeft: spacing.xs }}>
                        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]}>{a.project?.name}</Text>
                        {a.project?.address && (
                          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{a.project.address}</Text>
                        )}
                      </View>
                    </View>
                    <View style={[styles.assignmentDetailRow, { marginTop: spacing.xs }]}>
                      <Icon name="clock" size={14} color={colors.textSecondary} />
                      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                        {timeStr} · {a.truck?.name ?? 'No truck assigned'}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                Not scheduled
              </Text>
            )}
          </View>

          {isActive && (
            <Pressable
              style={({ pressed }) => [styles.sectionCard, styles.resourceRow, { backgroundColor: colors.surface }, shadow.sm, pressed && { opacity: 0.92 }]}
              onPress={() => router.push(`/(owner)/worker-access?personId=${p.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel="Manage resource access"
            >
              <View style={[styles.resourceIcon, { backgroundColor: colors.primarySurface }]}>
                <Icon name="key" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]}>Manage Resource Access</Text>
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                  {(() => {
                    const n = resourcesFor(p.id).length;
                    return n === 0 ? 'No company resources yet' : `Can open ${n} resource${n === 1 ? '' : 's'}`;
                  })()}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
          )}

          {isActive ? (
            <Pressable onPress={handleDeactivate} style={[styles.deactivateRow, { backgroundColor: semantic.errorLight }]}>
              <Icon name="user-x" size={16} color={semantic.error} />
              <Text style={[typeScale.labelLarge, { color: semantic.error, fontWeight: '700', marginLeft: spacing.xs }]}>
                Deactivate Worker
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.deactivatedBanner, { backgroundColor: semantic.errorLight }]}>
              <Icon name="alert-circle" size={16} color={semantic.error} />
              <Text style={[typeScale.bodySmall, { color: semantic.error, flex: 1, marginLeft: spacing.sm }]}>
                This worker has been deactivated. Historical records are preserved.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: { padding: spacing.xs },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: spacing['5xl'] },
  content: { paddingHorizontal: spacing.lg },
  profileCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.full,
  },
  sectionCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  assignmentBlock: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: 6,
  },
  assignmentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  assignmentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleWorkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  resourceRow: { flexDirection: 'row', alignItems: 'center' },
  resourceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  deactivateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  deactivatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
});
