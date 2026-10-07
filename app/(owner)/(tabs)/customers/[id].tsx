import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useCustomers } from '@/hooks/useCustomers';
import { StatusBadge, Avatar, ProgressBar, EmptyState } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';

const projectStatusBadge = (status: string): { label: string; status: 'success' | 'info' | 'warning' | 'neutral' } => {
  if (status === 'active') return { label: 'Active', status: 'success' };
  if (status === 'completed') return { label: 'Completed', status: 'info' };
  if (status === 'on_hold') return { label: 'On Hold', status: 'warning' };
  return { label: status.replace('_', ' '), status: 'neutral' };
};

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getCustomer } = useCustomers();

  const customer = getCustomer(id);

  if (!customer) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <EmptyState icon="alert-circle" title="Customer not found" description="This customer may have been removed." />
        </View>
      </View>
    );
  }

  const c = customer;
  const p = c.person;
  const customerProjects = c.projects;

  const statusInfo = c.member.status === 'active'
    ? { label: 'Active', status: 'success' as const }
    : c.member.status === 'invited'
    ? { label: 'Invited', status: 'info' as const }
    : { label: 'Inactive', status: 'neutral' as const };

  const portalInfo = c.member.status === 'active'
    ? { label: 'Portal Active', status: 'success' as const }
    : c.member.status === 'invited'
    ? { label: 'Invite Pending', status: 'info' as const }
    : { label: 'No Access', status: 'neutral' as const };

  function handleCall() {
    if (!p.phone) return;
    Linking.openURL(`tel:${p.phone.replace(/[^\d+]/g, '')}`);
  }

  function handleEmail() {
    Linking.openURL(`mailto:${p.email}`);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          Customer Profile
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
                  <StatusBadge label={statusInfo.label} status={statusInfo.status} />
                </View>
              </View>
            </View>

            <View style={styles.contactRow}>
              <Pressable
                style={[styles.contactBtn, { backgroundColor: colors.primarySurface }, !p.phone && { opacity: 0.4 }]}
                onPress={handleCall}
                disabled={!p.phone}
              >
                <Icon name="phone" size={16} color={colors.primary} />
                <Text style={[typeScale.labelLarge, { color: colors.textPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>Call</Text>
              </Pressable>
              <Pressable
                style={[styles.contactBtn, { backgroundColor: '#DCE9FB' }]}
                onPress={handleEmail}
              >
                <Icon name="mail" size={16} color="#2E6BD6" />
                <Text style={[typeScale.labelLarge, { color: colors.textPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>Email</Text>
              </Pressable>
            </View>
          </View>

          {/* Projects */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary, fontWeight: '700' }]}>
                Projects ({customerProjects.length})
              </Text>
              <Pressable
                style={[styles.addProjectBtn, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => router.push(`/(owner)/project-new?customerId=${p.id}` as any)}
              >
                <Icon name="plus" size={14} color={colors.textSecondary} />
                <Text style={[typeScale.labelSmall, { color: colors.textSecondary, fontWeight: '600', marginLeft: 4 }]}>Add Project</Text>
              </Pressable>
            </View>

            {customerProjects.length > 0 ? (
              customerProjects.map((proj, i) => {
                const badge = projectStatusBadge(proj.status);
                return (
                  <Pressable
                    key={proj.id}
                    style={[styles.projectRow, i > 0 && { marginTop: spacing.sm }]}
                    onPress={() => router.push(`/(owner)/projects/${proj.id}` as any)}
                  >
                    <View style={[styles.projectIcon, { backgroundColor: colors.backgroundTertiary }]}>
                      <Icon name="home" size={18} color={colors.textTertiary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <View style={styles.projectTopRow}>
                        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700', flexShrink: 1, marginRight: spacing.sm }]} numberOfLines={1}>
                          {proj.name}
                        </Text>
                        <StatusBadge label={badge.label} status={badge.status} />
                      </View>
                      {proj.address && (
                        <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{proj.address}</Text>
                      )}
                      <View style={styles.progressRow}>
                        <ProgressBar progress={proj.progress} height={5} style={{ flex: 1 }} />
                        <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.sm }]}>{proj.progress}%</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                  </Pressable>
                );
              })
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                No projects yet
              </Text>
            )}
          </View>

          {/* Account */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.sm }]}>Account</Text>

            <View style={styles.accountRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="calendar" size={14} color={colors.textTertiary} />
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>Customer since</Text>
              </View>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>
                {new Date(c.member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>

            <View style={[styles.accountRow, { marginTop: spacing.sm }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="eye" size={14} color={colors.textTertiary} />
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>Portal access</Text>
              </View>
              <StatusBadge label={portalInfo.label} status={portalInfo.status} />
            </View>
          </View>
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
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
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
  addProjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
