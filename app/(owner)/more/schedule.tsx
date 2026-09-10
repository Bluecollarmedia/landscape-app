import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSchedule } from '@/hooks/useSchedule';
import { Card, StatusBadge, Avatar, Divider, FilterChips } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import type { Assignment } from '@/types/schedule';

const today = new Date().toISOString().split('T')[0];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const t = new Date(today + 'T12:00:00');
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function offsetDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

const confirmBadge = (state: string) => {
  if (state === 'confirmed') return { label: 'Confirmed', status: 'success' as const };
  if (state === 'awaiting') return { label: 'Awaiting', status: 'warning' as const };
  if (state === 'updated_since') return { label: 'Updated', status: 'info' as const };
  return { label: 'Not Sent', status: 'neutral' as const };
};

const statusBadge = (status: string) => {
  if (status === 'completed') return { label: 'Completed', status: 'success' as const };
  if (status === 'cancelled') return { label: 'Cancelled', status: 'error' as const };
  if (status === 'reassigned') return { label: 'Reassigned', status: 'info' as const };
  return null;
};

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const [selectedDate, setSelectedDate] = useState(params.date ?? today);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);

  const schedule = useSchedule();
  const grouped = schedule.getGroupedByWorker(selectedDate);
  const allDayAssignments = schedule.getAllByDate(selectedDate);
  const cancelledCount = allDayAssignments.filter(a => a.status === 'cancelled' || a.status === 'reassigned').length;
  const weekData = schedule.weekSummary(getWeekStart(selectedDate));

  function handleCancel(assignment: Assignment) {
    const msg = `Cancel ${assignment.person?.firstName}'s assignment at ${assignment.project?.name}?`;
    if (Platform.OS === 'web') {
      const reason = prompt(msg + '\n\nReason (optional):');
      if (reason === null) return;
      schedule.cancelAssignment(assignment.id, reason || undefined);
    } else {
      Alert.alert('Cancel Assignment', msg, [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel Assignment', style: 'destructive', onPress: () => schedule.cancelAssignment(assignment.id) },
      ]);
    }
  }

  function handleMove(assignment: Assignment) {
    router.push(`/(owner)/more/schedule-create?moveFrom=${assignment.id}&workerId=${assignment.personId}&date=${selectedDate}` as any);
  }

  function renderDayView() {
    const workerIds = Object.keys(grouped);

    if (workerIds.length === 0) {
      return (
        <View style={styles.emptyDay}>
          <Feather name="calendar" size={48} color={colors.textTertiary} />
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: spacing.md }]}>
            No assignments scheduled
          </Text>
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/(owner)/more/schedule-create?date=${selectedDate}` as any)}
          >
            <Feather name="plus" size={18} color={colors.textOnPrimary} />
            <Text style={[typeScale.labelLarge, { color: colors.textOnPrimary }]}>Create Assignment</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        {workerIds.map((workerId) => {
          const group = grouped[workerId];
          const person = group.person!;
          const travelWarnings = schedule.detectTravelWarnings(workerId, selectedDate);

          return (
            <Card key={workerId} style={styles.workerCard}>
              <View style={styles.workerHeader}>
                <Avatar firstName={person.firstName} lastName={person.lastName} size={36} uri={person.avatarUrl} />
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>
                    {person.firstName} {person.lastName}
                  </Text>
                </View>
                {group.truck && (
                  <View style={[styles.truckChip, { backgroundColor: colors.backgroundTertiary }]}>
                    <Feather name="truck" size={12} color={colors.textSecondary} />
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{group.truck.name}</Text>
                  </View>
                )}
              </View>

              {group.assignments.map((a, idx) => {
                const timeStr = a.isFullDay ? 'Full Day' : `${a.startTime}–${a.endTime}`;
                const badge = confirmBadge(a.confirmationState);
                const isExpanded = expandedAssignment === a.id;

                return (
                  <React.Fragment key={a.id}>
                    {idx > 0 && <Divider style={{ marginVertical: spacing.xs }} />}
                    <Pressable
                      style={styles.assignmentRow}
                      onPress={() => setExpandedAssignment(isExpanded ? null : a.id)}
                    >
                      <View style={[styles.timeDot, { backgroundColor: colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                          {timeStr}  {a.project?.name}
                        </Text>
                        {a.notes && (
                          <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>
                            {a.notes}
                          </Text>
                        )}
                      </View>
                      <StatusBadge label={badge.label} status={badge.status} />
                    </Pressable>

                    {isExpanded && (
                      <View style={[styles.actionsRow, { backgroundColor: colors.backgroundTertiary }]}>
                        <Pressable style={styles.actionBtn} onPress={() => handleMove(a)}>
                          <Feather name="arrow-right-circle" size={16} color={colors.primary} />
                          <Text style={[typeScale.caption, { color: colors.primary }]}>Move</Text>
                        </Pressable>
                        <Pressable style={styles.actionBtn} onPress={() => handleCancel(a)}>
                          <Feather name="x-circle" size={16} color={semantic.error} />
                          <Text style={[typeScale.caption, { color: semantic.error }]}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => router.push(`/(owner)/projects/${a.projectId}` as any)}
                        >
                          <Feather name="external-link" size={16} color={colors.textSecondary} />
                          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Project</Text>
                        </Pressable>
                      </View>
                    )}
                  </React.Fragment>
                );
              })}

              {travelWarnings.length > 0 && (
                <View style={[styles.travelWarning, { backgroundColor: semantic.warningLight, borderColor: semantic.warning }]}>
                  <Feather name="clock" size={14} color={semantic.warning} />
                  <Text style={[typeScale.caption, { color: colors.textPrimary }]}>
                    {travelWarnings[0].availableMinutes} min gap between {travelWarnings[0].fromAssignment.project?.name} and {travelWarnings[0].toAssignment.project?.name}
                  </Text>
                </View>
              )}
            </Card>
          );
        })}

        {cancelledCount > 0 && (
          <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
            {cancelledCount} cancelled/reassigned assignment{cancelledCount > 1 ? 's' : ''} not shown
          </Text>
        )}
      </>
    );
  }

  function renderWeekView() {
    return (
      <>
        {weekData.map((day) => {
          const isToday = day.date === today;
          const isSelected = day.date === selectedDate;
          return (
            <Pressable
              key={day.date}
              style={[
                styles.weekRow,
                { borderBottomColor: colors.borderLight },
                isSelected && { backgroundColor: colors.primarySurface },
              ]}
              onPress={() => { setSelectedDate(day.date); setViewMode('day'); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[
                  typeScale.bodySmall,
                  { color: isToday ? colors.primary : colors.textPrimary, fontWeight: isToday ? '700' : '500' },
                ]}>
                  {day.label}{isToday ? ' (Today)' : ''}
                </Text>
                {day.workerCount > 0 ? (
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                    {day.workerCount} worker{day.workerCount > 1 ? 's' : ''} · {day.projectCount} project{day.projectCount > 1 ? 's' : ''}
                  </Text>
                ) : (
                  <Text style={[typeScale.caption, { color: colors.textTertiary }]}>No assignments</Text>
                )}
              </View>
              {day.hasIssues && (
                <View style={[styles.issueDot, { backgroundColor: semantic.warning }]} />
              )}
              <Feather name="chevron-right" size={16} color={colors.textTertiary} />
            </Pressable>
          );
        })}
      </>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>Schedule</Text>
        <Pressable
          onPress={() => router.push(`/(owner)/more/schedule-create?date=${selectedDate}` as any)}
          style={[styles.plusBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={20} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      <View style={styles.dateNav}>
        <Pressable onPress={() => setSelectedDate(offsetDateStr(selectedDate, viewMode === 'week' ? -7 : -1))}>
          <Feather name="chevron-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={() => setSelectedDate(today)}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
            {viewMode === 'week'
              ? `Week of ${new Date(getWeekStart(selectedDate) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : formatDateLabel(selectedDate)}
          </Text>
        </Pressable>
        <Pressable onPress={() => setSelectedDate(offsetDateStr(selectedDate, viewMode === 'week' ? 7 : 1))}>
          <Feather name="chevron-right" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.viewToggle}>
        <Pressable
          style={[styles.toggleBtn, viewMode === 'day' && { backgroundColor: colors.primary }]}
          onPress={() => setViewMode('day')}
        >
          <Text style={[typeScale.labelSmall, { color: viewMode === 'day' ? colors.textOnPrimary : colors.textSecondary }]}>Day</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, viewMode === 'week' && { backgroundColor: colors.primary }]}
          onPress={() => setViewMode('week')}
        >
          <Text style={[typeScale.labelSmall, { color: viewMode === 'week' ? colors.textOnPrimary : colors.textSecondary }]}>Week</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {viewMode === 'day' ? renderDayView() : renderWeekView()}
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
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  backButton: { padding: spacing.xs },
  plusBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dateNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },
  workerCard: { marginBottom: spacing.md },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  truckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timeDot: { width: 6, height: 6, borderRadius: 3 },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  travelWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderLeftWidth: 2,
    marginTop: spacing.sm,
  },
  emptyDay: { alignItems: 'center', paddingVertical: spacing['3xl'] },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.lg,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  issueDot: { width: 8, height: 8, borderRadius: 4 },
});
