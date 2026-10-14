import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { StatusBadge, Avatar, OptimizedImage, ScreenHeader, SegmentedTabs, PressableScale, FadeInItem, IconTile } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { useJoinRequests } from '@/hooks/useOnboarding';
import type { JoinRequest } from '@/types/onboarding';
import { haptics } from '@/lib/haptics';

function formatTimeAgo(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function joinMethodLabel(method: string): string {
  if (method === 'team_code') return 'Team Code';
  if (method === 'email_invitation') return 'Direct Invitation';
  return 'Invitation Link';
}

type Tab = 'pending' | 'history';

export default function PendingRequestsScreen() {
  const { colors } = useTheme();
  const { pendingRequests, allRequests, approveRequest, declineRequest } = useJoinRequests();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleApprove(request: JoinRequest) {
    haptics.success();
    // Also makes them an active worker (see approve_join_request in supabase/schema.sql).
    approveRequest(request.id, 'worker');
  }

  function handleDecline(request: JoinRequest) {
    haptics.destructive();
    if (Platform.OS === 'web') {
      const reason = prompt('Reason for declining (optional):');
      declineRequest(request.id, reason ?? undefined);
    } else {
      declineRequest(request.id);
    }
  }

  const historyRequests = allRequests.filter((r) => r.status !== 'pending');

  const displayRequests = activeTab === 'pending' ? pendingRequests : historyRequests;

  function renderRequestCard(request: JoinRequest, index: number) {
    const isExpanded = expandedId === request.id;
    const person = request.person;
    if (!person) return null;

    return (
      <FadeInItem key={`${activeTab}-${request.id}`} index={index}>
        <PressableScale
          style={[styles.requestCard, { backgroundColor: colors.surface }]}
          scaleTo={0.98}
          onPress={() => setExpandedId(isExpanded ? null : request.id)}
        >
          <View style={styles.requestHeader}>
            {person.profilePhotoUrl ? (
              <OptimizedImage source={person.profilePhotoUrl} style={styles.photo} />
            ) : (
              <Avatar firstName={person.firstName} lastName={person.lastName} size={52} />
            )}
            <View style={styles.requestInfo}>
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>
                {person.firstName} {person.lastName}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{person.email}</Text>
              {person.phone && (
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{person.phone}</Text>
              )}
            </View>
            {request.status === 'pending' && <StatusBadge label="Pending" status="warning" />}
            {request.status === 'approved' && <StatusBadge label="Approved" status="success" />}
            {request.status === 'declined' && <StatusBadge label="Declined" status="error" />}
            {request.status === 'cancelled' && <StatusBadge label="Cancelled" status="neutral" />}
          </View>

          <View style={[styles.metaRow, { borderTopColor: colors.borderLight }]}>
            <View style={styles.metaItem}>
              <Text style={[typeScale.overline, { color: colors.textTertiary }]}>JOINED VIA</Text>
              <View style={styles.metaValue}>
                <Icon
                  name={request.joinMethod === 'team_code' ? 'hash' : 'mail'}
                  size={12}
                  color={colors.textSecondary}
                />
                <Text style={[typeScale.caption, { color: colors.textPrimary, marginLeft: 4 }]}>
                  {joinMethodLabel(request.joinMethod)}
                </Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Text style={[typeScale.overline, { color: colors.textTertiary }]}>REQUESTED</Text>
              <Text style={[typeScale.caption, { color: colors.textPrimary }]}>
                {formatDate(request.createdAt)}
              </Text>
            </View>
          </View>

          {request.status === 'pending' && (
            <View style={styles.actions}>
              <PressableScale
                style={[styles.approveBtn, { backgroundColor: semantic.success }]}
                scaleTo={0.94}
                haptic={false}
                onPress={() => handleApprove(request)}
                accessibilityRole="button"
              >
                <Icon name="check" size={16} color="#FFFFFF" />
                <Text style={[typeScale.labelSmall, { color: '#FFFFFF', marginLeft: 4 }]}>Approve</Text>
              </PressableScale>
              <PressableScale
                style={[styles.declineBtn, { borderColor: semantic.error, backgroundColor: colors.surface }]}
                scaleTo={0.94}
                haptic={false}
                onPress={() => handleDecline(request)}
                accessibilityRole="button"
              >
                <Icon name="x" size={16} color={semantic.error} />
                <Text style={[typeScale.labelSmall, { color: semantic.error, marginLeft: 4 }]}>Decline</Text>
              </PressableScale>
            </View>
          )}

          {request.status === 'approved' && request.reviewedAt && (
            <View style={[styles.reviewInfo, { backgroundColor: semantic.successLight }]}>
              <Icon name="check-circle" size={14} color={semantic.success} />
              <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                Approved {formatTimeAgo(request.reviewedAt)} — Role: {request.assignedRole ?? 'Worker'}
              </Text>
            </View>
          )}

          {request.status === 'declined' && (
            <View style={[styles.reviewInfo, { backgroundColor: semantic.errorLight }]}>
              <Icon name="x-circle" size={14} color={semantic.error} />
              <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                Declined {request.reviewedAt ? formatTimeAgo(request.reviewedAt) : ''}
                {request.declineReason ? ` — ${request.declineReason}` : ''}
              </Text>
            </View>
          )}
        </PressableScale>
      </FadeInItem>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title="Join Requests" subtitle="People asking to join your team" />

      <SegmentedTabs
        options={[
          { value: 'pending' as Tab, label: `Pending (${pendingRequests.length})` },
          { value: 'history' as Tab, label: 'History' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {displayRequests.length === 0 && (
          <View style={styles.empty}>
            <IconTile name="inbox" size={56} muted />
            <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {activeTab === 'pending' ? 'No pending requests' : 'No request history'}
            </Text>
          </View>
        )}

        {displayRequests.map(renderRequestCard)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  requestCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      android: { elevation: 2 },
      default: {
        shadowColor: '#1B3A2D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
    }),
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  requestInfo: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  metaItem: {
    flex: 1,
  },
  metaValue: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    ...Platform.select({
      android: { elevation: 3 },
      default: {
        shadowColor: '#2E7D32',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  reviewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
});
