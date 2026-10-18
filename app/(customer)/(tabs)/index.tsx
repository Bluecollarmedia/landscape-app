import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { Card, ProgressBar, StatusBadge, EmptyState } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { db, useDb } from '@/data/store';
import { useMyMaintenanceProperties } from '@/data/maintenanceCustomer';
import type { ProjectStatus } from '@/types/project';

const statusConfig: Record<ProjectStatus, { label: string; type: 'success' | 'warning' | 'info' | 'neutral' }> = {
  prospect: { label: 'Quote', type: 'neutral' },
  active: { label: 'Active', type: 'success' },
  on_hold: { label: 'On Hold', type: 'warning' },
  completed: { label: 'Completed', type: 'info' },
  archived: { label: 'Archived', type: 'neutral' },
};

export default function CustomerHomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myMaintenance = useMyMaintenanceProperties();

  useDb();
  const customerProjects = db.projects.filter(p => p.customerId === user?.id || p.customerClaimedBy === user?.id);
  const activeProjects = customerProjects.filter(p => p.status === 'active' || p.status === 'on_hold');
  const completedProjects = customerProjects.filter(p => p.status === 'completed');

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <ScreenContainer scrollable padded>
      <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.xl }}>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Welcome back</Text>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
          {user?.firstName ?? 'there'}
        </Text>
      </View>

      {myMaintenance.length > 0 && (
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Maintenance
          </Text>
          {myMaintenance.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => router.push('/(customer)/maintenance-updates' as any)}
              accessibilityRole="button"
              accessibilityLabel={`${m.name}, maintenance updates`}
              style={[styles.maintRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Icon name="repeat" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={1}>{m.name}</Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                  {m.address ? `${m.address} · ` : ''}Visits and photos
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}

      {customerProjects.length === 0 ? (
        myMaintenance.length === 0 ? (
          <EmptyState
            icon="layers"
            title="No projects yet"
            description="Your landscaping project progress and updates will appear here."
          />
        ) : null
      ) : (
        <>
          {activeProjects.length > 0 && (
            <View style={{ marginBottom: spacing.xl }}>
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Active Projects
              </Text>
              {activeProjects.map(project => {
                const config = statusConfig[project.status];
                return (
                  <Pressable
                    key={project.id}
                    onPress={() => router.push(`/(customer)/project?id=${project.id}` as any)}
                  >
                    <Card style={styles.projectCard}>
                      <View style={styles.projectHeader}>
                        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
                          {project.name}
                        </Text>
                        <StatusBadge label={config.label} status={config.type} />
                      </View>

                      {project.address && (
                        <View style={styles.detailRow}>
                          <Icon name="map-pin" size={14} color={colors.textTertiary} />
                          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                            {project.address}{project.city ? `, ${project.city}` : ''}
                          </Text>
                        </View>
                      )}

                      <View style={styles.progressSection}>
                        <View style={styles.progressHeader}>
                          <Text style={[typeScale.headingSmall, { color: colors.primary }]}>{project.progress}%</Text>
                          <Text style={[typeScale.caption, { color: colors.textTertiary }]}>complete</Text>
                        </View>
                        <ProgressBar progress={project.progress} height={6} />
                      </View>

                      {project.estimatedEndDate && (
                        <View style={styles.detailRow}>
                          <Icon name="calendar" size={14} color={colors.textTertiary} />
                          <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                            Est. completion: {formatDate(project.estimatedEndDate)}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.viewMore, { borderTopColor: colors.borderLight }]}>
                        <Text style={[typeScale.bodySmall, { color: colors.primary, fontWeight: '600' }]}>
                          View Project
                        </Text>
                        <Icon name="chevron-right" size={16} color={colors.primary} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}

          {completedProjects.length > 0 && (
            <View style={{ marginBottom: spacing.xl }}>
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Completed
              </Text>
              {completedProjects.map(project => (
                <Pressable
                  key={project.id}
                  onPress={() => router.push(`/(customer)/project?id=${project.id}` as any)}
                >
                  <Card style={styles.projectCard}>
                    <View style={styles.projectHeader}>
                      <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]}>
                        {project.name}
                      </Text>
                      <StatusBadge label="Completed" status="info" />
                    </View>
                    {project.completedAt && (
                      <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                        Completed {formatDate(project.completedAt)}
                      </Text>
                    )}
                    <View style={[styles.viewMore, { borderTopColor: colors.borderLight }]}>
                      <Text style={[typeScale.bodySmall, { color: colors.primary }]}>View Project</Text>
                      <Icon name="chevron-right" size={16} color={colors.primary} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  maintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  projectCard: {
    marginBottom: spacing.md,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  progressSection: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  viewMore: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});
