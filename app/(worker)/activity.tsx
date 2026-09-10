import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { EmptyState } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import type { WorkerActivity, WorkerActivityType } from '@/types/worker';

const ACTIVITY_CONFIG: Record<WorkerActivityType, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  schedule_confirmed: { icon: 'check-circle', color: semantic.success },
  checked_in: { icon: 'log-in', color: semantic.info },
  task_started: { icon: 'play', color: semantic.warning },
  task_completed: { icon: 'check-square', color: semantic.success },
  photo_taken: { icon: 'camera', color: '#8E24AA' },
  checked_out: { icon: 'log-out', color: semantic.error },
  schedule_acknowledged: { icon: 'eye', color: semantic.info },
  overtime_flagged: { icon: 'alert-circle', color: semantic.warning },
};

function formatTimestamp(ts: string) {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return mins <= 1 ? 'Just now' : `${mins}m ago`;
  }
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function groupByDate(activities: WorkerActivity[]) {
  const groups: { date: string; label: string; items: WorkerActivity[] }[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  for (const a of activities) {
    const dateStr = a.timestamp.split('T')[0];
    let label = new Date(a.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (dateStr === today) label = 'Today';
    else if (dateStr === yesterdayStr) label = 'Yesterday';

    const existing = groups.find(g => g.date === dateStr);
    if (existing) {
      existing.items.push(a);
    } else {
      groups.push({ date: dateStr, label, items: [a] });
    }
  }
  return groups;
}

export default function WorkerActivityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activities } = useWorkerContext();

  const groups = groupByDate(activities);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Activity</Text>
      </View>

      {activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="activity"
            title="No activity yet"
            description="Your check-ins, tasks, and photos will appear here."
          />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => item.date}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: group }) => (
            <View style={styles.dateGroup}>
              <Text style={[typeScale.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
                {group.label}
              </Text>
              {group.items.map((activity, idx) => {
                const config = ACTIVITY_CONFIG[activity.activityType];
                return (
                  <View
                    key={activity.id}
                    style={[styles.activityRow, { borderLeftColor: config.color }]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: config.color + '18' }]}>
                      <Feather name={config.icon} size={16} color={config.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.bodyMedium, { color: colors.textPrimary }]}>
                        {activity.description}
                      </Text>
                      <View style={styles.metaRow}>
                        {activity.project && (
                          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                            {activity.project.name}
                          </Text>
                        )}
                        <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                          {formatTimestamp(activity.timestamp)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  dateGroup: { marginBottom: spacing.xl },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 3,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
});
