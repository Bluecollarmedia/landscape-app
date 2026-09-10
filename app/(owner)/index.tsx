import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useDashboard } from '@/hooks/useDashboard';
import { useNotifications, useAttendance } from '@/hooks/useOperations';
import { Card, StatusBadge, Avatar } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function OwnerDashboard() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { stats, attentionItems, todaySchedule, recentAnnouncements, activeProjects } = useDashboard();
  const { unreadCount } = useNotifications();
  const { getAttendanceForDate } = useAttendance();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = getAttendanceForDate(todayStr);
  const checkedInCount = todayAttendance.reduce(
    (count, wa) => count + wa.assignments.filter((a) => a.status === 'checked_in' || a.status === 'late' || a.status === 'past_scheduled_end').length,
    0,
  );
  const missingCount = todayAttendance.reduce(
    (count, wa) => count + wa.assignments.filter((a) => a.status === 'not_checked_in').length,
    0,
  );

  function renderQuickActions() {
    const actions = [
      { label: 'Schedule', icon: 'calendar' as const, route: '/(owner)/more/schedule' },
      { label: 'New Project', icon: 'plus-circle' as const, route: '/(owner)/projects/new' },
      { label: 'Add Worker', icon: 'user-plus' as const, route: '/(owner)/workers/new' },
      { label: 'Announce', icon: 'volume-2' as const, route: '/(owner)/more/announcements' },
    ];

    return (
      <View style={styles.quickActions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            style={[styles.quickAction, { backgroundColor: colors.primarySurface }]}
            onPress={() => router.push(a.route as any)}
          >
            <Feather name={a.icon} size={20} color={colors.primary} />
            <Text style={[typeScale.caption, { color: colors.primary, marginTop: 4 }]}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderStatCards() {
    return (
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[typeScale.displaySmall, { color: colors.primary }]}>{stats.activeProjectCount}</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Active Projects</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[typeScale.displaySmall, { color: colors.primary }]}>{stats.confirmed}/{stats.scheduledToday}</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Confirmed</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[typeScale.displaySmall, { color: colors.primary }]}>{stats.availableTruckCount}</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Trucks Ready</Text>
        </View>
      </View>
    );
  }

  function renderAttention() {
    if (attentionItems.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={[typeScale.headingSmall, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Needs Attention
        </Text>
        {attentionItems.map((item) => (
          <View
            key={item.id}
            style={[
              styles.attentionItem,
              {
                backgroundColor: item.severity === 'warning' ? semantic.warningLight : semantic.infoLight,
                borderColor: item.severity === 'warning' ? semantic.warning : semantic.info,
              },
            ]}
          >
            <Feather
              name={item.icon as any}
              size={18}
              color={item.severity === 'warning' ? semantic.warning : semantic.info}
            />
            <View style={styles.attentionText}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>
                {item.title}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                {item.subtitle}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  function renderTodaySchedule() {
    const confirmLabel = (state: string) => {
      if (state === 'confirmed') return { label: 'Confirmed', status: 'success' as const };
      if (state === 'awaiting') return { label: 'Awaiting', status: 'warning' as const };
      return { label: 'Not Sent', status: 'neutral' as const };
    };

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
            Today's Schedule
          </Text>
          <Pressable onPress={() => router.push('/(owner)/more/schedule' as any)}>
            <Text style={[typeScale.labelSmall, { color: colors.primary }]}>View All</Text>
          </Pressable>
        </View>
        {todaySchedule.map((entry) => {
          const badge = confirmLabel(entry.confirmationState);
          const timeStr = entry.isFullDay ? 'Full Day' : `${entry.startTime}–${entry.endTime}`;
          return (
            <Pressable
              key={entry.id}
              style={[styles.scheduleRow, { borderBottomColor: colors.borderLight }]}
              onPress={() => router.push(`/(owner)/projects/${entry.projectId}` as any)}
            >
              <Avatar
                firstName={entry.person?.firstName ?? '?'}
                lastName={entry.person?.lastName ?? '?'}
                size={36}
                uri={entry.person?.avatarUrl}
              />
              <View style={styles.scheduleInfo}>
                <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '500' }]}>
                  {entry.person?.firstName} {entry.person?.lastName}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                  {entry.project?.name} · {timeStr}
                </Text>
              </View>
              <StatusBadge label={badge.label} status={badge.status} />
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderActiveProjects() {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
            Active Projects
          </Text>
          <Pressable onPress={() => router.push('/(owner)/projects' as any)}>
            <Text style={[typeScale.labelSmall, { color: colors.primary }]}>View All</Text>
          </Pressable>
        </View>
        {activeProjects.slice(0, 4).map((p) => (
          <Pressable
            key={p.id}
            style={[styles.projectRow, { borderBottomColor: colors.borderLight }]}
            onPress={() => router.push(`/(owner)/projects/${p.id}` as any)}
          >
            <View style={styles.projectInfo}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '500' }]}>
                {p.name}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                {p.customer?.firstName} {p.customer?.lastName} · {p.progress}%
              </Text>
            </View>
            <View style={styles.progressMini}>
              <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: p.progress === 100 ? semantic.success : colors.primary,
                      width: `${p.progress}%`,
                    },
                  ]}
                />
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    );
  }

  function renderAnnouncements() {
    if (recentAnnouncements.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
            Recent Announcements
          </Text>
          <Pressable onPress={() => router.push('/(owner)/more/announcements' as any)}>
            <Text style={[typeScale.labelSmall, { color: colors.primary }]}>View All</Text>
          </Pressable>
        </View>
        {recentAnnouncements.map((ann) => (
          <Card key={ann.id} style={styles.announcementCard}>
            <View style={styles.announcementHeader}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600', flex: 1 }]}>
                {ann.title}
              </Text>
              {ann.priority === 'urgent' && (
                <StatusBadge label="Urgent" status="error" />
              )}
            </View>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={2}>
              {ann.body}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
              {ann.readCount}/{ann.totalRecipients} read
            </Text>
          </Card>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              {getGreeting()}
            </Text>
            <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
              {user?.firstName ?? 'Owner'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(owner)/more' as any)}
            style={[styles.avatarButton, { backgroundColor: colors.primarySurface }]}
          >
            <Feather name="user" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {renderQuickActions()}
          {renderStatCards()}
          <View style={styles.opsRow}>
            <Pressable
              style={[styles.opsCard, { backgroundColor: checkedInCount > 0 ? semantic.successLight : colors.surface, borderColor: colors.borderLight }]}
              onPress={() => router.push('/(owner)/more/attendance' as any)}
            >
              <Feather name="user-check" size={16} color={semantic.success} />
              <Text style={[typeScale.labelSmall, { color: colors.textPrimary }]}>{checkedInCount} on site</Text>
            </Pressable>
            {missingCount > 0 && (
              <Pressable
                style={[styles.opsCard, { backgroundColor: semantic.errorLight, borderColor: semantic.error + '30' }]}
                onPress={() => router.push('/(owner)/more/attendance' as any)}
              >
                <Feather name="x-circle" size={16} color={semantic.error} />
                <Text style={[typeScale.labelSmall, { color: semantic.error }]}>{missingCount} missing</Text>
              </Pressable>
            )}
            {unreadCount > 0 && (
              <Pressable
                style={[styles.opsCard, { backgroundColor: semantic.infoLight, borderColor: semantic.info + '30' }]}
                onPress={() => router.push('/(owner)/more/notification-center' as any)}
              >
                <Feather name="bell" size={16} color={semantic.info} />
                <Text style={[typeScale.labelSmall, { color: semantic.info }]}>{unreadCount} alerts</Text>
              </Pressable>
            )}
          </View>
          {renderAttention()}
          {renderTodaySchedule()}
          {renderActiveProjects()}
          {renderAnnouncements()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: spacing['5xl'] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: spacing.lg },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  opsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  opsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  attentionText: { flex: 1 },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  scheduleInfo: { flex: 1 },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  projectInfo: { flex: 1 },
  progressMini: { width: 60 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  announcementCard: { marginBottom: spacing.sm },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
});
