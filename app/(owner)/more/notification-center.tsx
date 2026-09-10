import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { useNotifications } from '@/hooks/useOperations';
import type { NotificationEventType } from '@/types/operations';

const EVENT_ICONS: Record<NotificationEventType, { icon: string; color: string }> = {
  worker_checked_in: { icon: 'log-in', color: '#43A047' },
  worker_checked_out: { icon: 'log-out', color: '#757575' },
  worker_checked_in_late: { icon: 'alert-circle', color: '#F9A825' },
  worker_outside_radius: { icon: 'map-pin', color: '#D32F2F' },
  worker_not_checked_in: { icon: 'x-circle', color: '#D32F2F' },
  worker_past_scheduled_end: { icon: 'clock', color: '#F9A825' },
  worker_completed_task: { icon: 'check-square', color: '#43A047' },
  worker_completed_job: { icon: 'check-circle', color: '#43A047' },
  photo_waiting_review: { icon: 'camera', color: '#1976D2' },
  customer_request_submitted: { icon: 'message-square', color: '#1976D2' },
  schedule_changed: { icon: 'calendar', color: '#7CB342' },
  schedule_conflict: { icon: 'alert-triangle', color: '#D32F2F' },
};

function formatTimeAgo(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationCenterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderLight }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
          Notifications
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={12}>
            <Text style={[typeScale.labelSmall, { color: colors.primary }]}>Read All</Text>
          </Pressable>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {unreadCount > 0 && (
        <View style={[styles.unreadBanner, { backgroundColor: colors.primarySurface }]}>
          <Text style={[typeScale.labelSmall, { color: colors.primary }]}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sorted.map((n) => {
          const eventConfig = EVENT_ICONS[n.eventType];
          const isUnread = n.status === 'unread';
          return (
            <Pressable
              key={n.id}
              style={[
                styles.notifRow,
                { borderBottomColor: colors.borderLight },
                isUnread && { backgroundColor: colors.primarySurface + '40' },
              ]}
              onPress={() => {
                if (isUnread) markRead(n.id);
              }}
            >
              <View
                style={[
                  styles.notifIcon,
                  { backgroundColor: eventConfig.color + '18' },
                ]}
              >
                <Feather name={eventConfig.icon as any} size={18} color={eventConfig.color} />
              </View>
              <View style={styles.notifContent}>
                <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: isUnread ? '600' : '400' }]}>
                  {n.title}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                  {n.body}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing['2xs'] }]}>
                  {formatTimeAgo(n.createdAt)}
                </Text>
              </View>
              {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
            </Pressable>
          );
        })}

        {sorted.length === 0 && (
          <View style={styles.empty}>
            <Feather name="bell-off" size={48} color={colors.textTertiary} />
            <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: spacing.md }]}>
              No notifications yet
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  unreadBanner: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  content: { paddingBottom: spacing['5xl'] },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: spacing.xs,
  },
  empty: { alignItems: 'center', paddingVertical: spacing['4xl'] },
});
