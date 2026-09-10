import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { radius, spacing, shadow } from '@/theme/spacing';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Project, ProjectStatus } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

const statusConfig: Record<ProjectStatus, { label: string; type: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  active: { label: 'Active', type: 'success' },
  on_hold: { label: 'On Hold', type: 'warning' },
  completed: { label: 'Completed', type: 'info' },
  archived: { label: 'Archived', type: 'neutral' },
};

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const { colors } = useTheme();
  const config = statusConfig[project.status];
  const customerName = project.customer
    ? `${project.customer.firstName} ${project.customer.lastName}`
    : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
          ...shadow.sm,
        },
        pressed && { opacity: 0.92 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${config.label}, ${project.progress}% complete`}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]} numberOfLines={1}>
            {project.name}
          </Text>
          <StatusBadge label={config.label} status={config.type} />
        </View>
        {customerName && (
          <View style={styles.customerRow}>
            <Feather name="user" size={13} color={colors.textTertiary} />
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              {customerName}
            </Text>
          </View>
        )}
      </View>

      {project.address && (
        <View style={styles.addressRow}>
          <Feather name="map-pin" size={13} color={colors.textTertiary} />
          <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>
            {project.address}{project.city ? `, ${project.city}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.progressSection}>
        <ProgressBar progress={project.progress} showLabel height={6} />
      </View>

      <View style={styles.metaRow}>
        {project.teamCount !== undefined && (
          <View style={styles.metaItem}>
            <Feather name="users" size={13} color={colors.textTertiary} />
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
              {project.teamCount}
            </Text>
          </View>
        )}
        {project.taskCount !== undefined && (
          <View style={styles.metaItem}>
            <Feather name="check-square" size={13} color={colors.textTertiary} />
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
              {(project.taskCount ?? 0) - (project.openTaskCount ?? 0)}/{project.taskCount}
            </Text>
          </View>
        )}
        <View style={styles.metaSpacer} />
        <Feather name="chevron-right" size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaSpacer: {
    flex: 1,
  },
});
