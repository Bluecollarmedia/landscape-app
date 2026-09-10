import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { Card, Button, StatusBadge, Avatar, OptimizedImage } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { useJoinRequests, useMemberships } from '@/hooks/useOnboarding';
import type { JoinRequest } from '@/types/onboarding';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingRequests, allRequests, approveRequest, declineRequest } = useJoinRequests();
  const { createMembership } = useMemberships();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleApprove(request: JoinRequest) {
    approveRequest(request.id, 'worker');
    if (request.person) {
      createMembership({
        personId: request.personId,
        role: 'worker',
        joinMethod: request.joinMethod,
        joinRequestId: request.id,
        person: request.person,
      });
    }
  }

  function handleDecline(request: JoinRequest) {
    if (Platform.OS === 'web') {
      const reason = prompt('Reason for declining (optional):');
      declineRequest(request.id, reason ?? undefined);
    } else {
      declineRequest(request.id);
    }
  }

  const historyRequests = allRequests.filter((r) => r.status !== 'pending');

  const displayRequests = activeTab === 'pending' ? pendingRequests : historyRequests;

  function renderRequestCard(request: JoinRequest) {
    const isExpanded = expandedId === request.id;
    const person = request.person;
    if (!person) return null;

    return (
      <Pressable
        key={request.id}
        style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
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
              <Feather
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
            <Pressable
              style={[styles.approveBtn, { backgroundColor: semantic.success }]}
              onPress={() => handleApprove(request)}
            >
              <Feather name="check" size={16} color="#FFFFFF" />
              <Text style={[typeScale.labelSmall, { color: '#FFFFFF', marginLeft: 4 }]}>Approve</Text>
            </Pressable>
            <Pressable
              style={[styles.declineBtn, { borderColor: semantic.error }]}
              onPress={() => handleDecline(request)}
            >
              <Feather name="x" size={16} color={semantic.error} />
              <Text style={[typeScale.labelSmall, { color: semantic.error, marginLeft: 4 }]}>Decline</Text>
            </Pressable>
          </View>
        )}

        {request.status === 'approved' && request.reviewedAt && (
          <View style={[styles.reviewInfo, { backgroundColor: semantic.successLight }]}>
            <Feather name="check-circle" size={14} color={semantic.success} />
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
              Approved {formatTimeAgo(request.reviewedAt)} — Role: {request.assignedRole ?? 'Worker'}
            </Text>
          </View>
        )}

        {request.status === 'declined' && (
          <View style={[styles.reviewInfo, { backgroundColor: semantic.errorLight }]}>
            <Feather name="x-circle" size={14} color={semantic.error} />
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
              Declined {request.reviewedAt ? formatTimeAgo(request.reviewedAt) : ''}
              {request.declineReason ? ` — ${request.declineReason}` : ''}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
          Join Requests
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.borderLight }]}>
        <Pressable
          style={[styles.tab, activeTab === 'pending' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[typeScale.labelSmall, { color: activeTab === 'pending' ? colors.primary : colors.textSecondary }]}>
            Pending ({pendingRequests.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'history' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[typeScale.labelSmall, { color: activeTab === 'history' ? colors.primary : colors.textSecondary }]}>
            History
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {displayRequests.length === 0 && (
          <View style={styles.empty}>
            <Feather name="inbox" size={48} color={colors.textTertiary} />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  requestCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  reviewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.xs,
    marginTop: spacing.md,
  },
});
