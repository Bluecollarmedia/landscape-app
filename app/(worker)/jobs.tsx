import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { EmptyState, StatusBadge, FilterChips } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { Assignment } from '@/types/schedule';

type TabKey = 'today' | 'upcoming' | 'completed';

function formatTime(time?: string) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Today';
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getStatusInfo(assignment: Assignment): { label: string; status: 'success' | 'warning' | 'neutral' | 'info' } {
  switch (assignment.status) {
    case 'completed': return { label: 'Completed', status: 'success' };
    case 'checked_in':
    case 'working': return { label: 'In Progress', status: 'warning' };
    case 'confirmed': return { label: 'Confirmed', status: 'info' };
    default: return { label: 'Scheduled', status: 'neutral' };
  }
}

function JobRow({ assignment }: { assignment: Assignment }) {
  const { colors } = useTheme();
  const { openMapsNavigation } = useWorkerContext();
  const statusInfo = getStatusInfo(assignment);

  return (
    <View style={[styles.jobRow, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <View style={styles.jobContent}>
        <View style={styles.jobTop}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]}>
            {assignment.project?.name ?? 'Unknown'}
          </Text>
          <StatusBadge label={statusInfo.label} status={statusInfo.status} />
        </View>

        <View style={styles.jobMeta}>
          <Feather name="calendar" size={13} color={colors.textTertiary} />
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
            {formatDate(assignment.scheduledDate)}
          </Text>
          <Text style={[typeScale.caption, { color: colors.textTertiary, marginHorizontal: 6 }]}>·</Text>
          <Feather name="clock" size={13} color={colors.textTertiary} />
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
            {assignment.isFullDay ? 'Full day' : `${formatTime(assignment.startTime)} – ${formatTime(assignment.endTime)}`}
          </Text>
        </View>

        {assignment.project?.address && (
          <Pressable
            style={styles.addressRow}
            onPress={() => openMapsNavigation(assignment.project!.address!)}
          >
            <Feather name="map-pin" size={13} color={colors.primary} />
            <Text style={[typeScale.caption, { color: colors.primary, marginLeft: 4 }]}>
              {assignment.project.address}
            </Text>
          </Pressable>
        )}

        {assignment.truck && (
          <View style={styles.truckRow}>
            <Feather name="truck" size={13} color={colors.textTertiary} />
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              {assignment.truck.name}
            </Text>
          </View>
        )}

        {assignment.notes && (
          <Text style={[typeScale.caption, { color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.xs }]}>
            {assignment.notes}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function WorkerJobsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('today');
  const { todayAssignments, upcomingAssignments, completedAssignments } = useWorkerContext();

  const filterOptions: { key: TabKey; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: todayAssignments.length },
    { key: 'upcoming', label: 'Upcoming', count: upcomingAssignments.length },
    { key: 'completed', label: 'Completed', count: completedAssignments.length },
  ];

  const data = tab === 'today' ? todayAssignments
    : tab === 'upcoming' ? upcomingAssignments
    : completedAssignments;

  const emptyMessage = tab === 'today' ? 'No jobs scheduled for today'
    : tab === 'upcoming' ? 'No upcoming jobs'
    : 'No completed jobs yet';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>My Jobs</Text>
        <FilterChips
          options={filterOptions}
          selected={tab}
          onSelect={setTab}
        />
      </View>

      {data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="clipboard"
            title={emptyMessage}
            description="Your assigned jobs will appear here."
          />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <JobRow assignment={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  jobRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  jobContent: {
    padding: spacing.md,
  },
  jobTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  truckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
});
