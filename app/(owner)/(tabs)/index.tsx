import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useOwnerDashboard, type AttentionItem, type CrewMember, type ProjectHomeSummary } from '@/hooks/useOwnerDashboard';
import { Avatar, OptimizedImage, ProgressBar } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { semantic } from '@/theme/colors';

const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

const HERO_IMAGE_URI = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80';
const PROJECT_IMAGES = [
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&q=80',
  'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80',
  'https://images.unsplash.com/photo-1571939228382-b2f2b585ce15?w=600&q=80',
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const SEVERITY_COLORS: Record<AttentionItem['severity'], { bg: string; icon: string }> = {
  critical: { bg: semantic.errorLight, icon: semantic.error },
  warning: { bg: semantic.warningLight, icon: semantic.warning },
  info: { bg: semantic.infoLight, icon: semantic.info },
};

const QUICK_ACTIONS = [
  { label: 'New Project', icon: 'plus-circle' as const, route: '/(owner)/project-new' },
  { label: 'Schedule Worker', icon: 'calendar' as const, route: '/(owner)/schedule-create' },
  { label: 'Add Worker', icon: 'user-plus' as const, route: '/(owner)/worker-new' },
  { label: 'Announcement', icon: 'volume-2' as const, route: '/(owner)/more/announcements' },
];

export default function OwnerDashboard() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const {
    todayStats, attentionItems, attentionTotalCount,
    crewToday, crewTodayTotal, activeProjects, activeProjectsTotal,
  } = useOwnerDashboard();

  function renderHeroStat(icon: React.ReactNode, value: number, label: string) {
    return (
      <View style={styles.heroStat}>
        <View style={styles.heroStatIconRow}>
          {icon}
          <Text style={[typeScale.headingLarge, { color: '#FFFFFF', marginLeft: spacing.xs }]}>{value}</Text>
        </View>
        <Text style={[typeScale.caption, { color: 'rgba(255,255,255,0.85)' }]}>{label}</Text>
      </View>
    );
  }

  function renderAttentionRow(item: AttentionItem) {
    const c = SEVERITY_COLORS[item.severity];
    return (
      <Pressable
        key={item.id}
        style={[styles.attentionRow, { backgroundColor: c.bg }]}
        onPress={() => router.push(item.route as any)}
      >
        <View style={[styles.attentionIcon, { backgroundColor: c.icon }]}>
          <Icon name={item.icon} size={16} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        <Pressable
          style={[styles.attentionAction, { backgroundColor: colors.surface }]}
          onPress={() => router.push(item.route as any)}
          hitSlop={8}
        >
          <Text style={[typeScale.labelSmall, { color: c.icon }]}>{item.actionLabel}</Text>
        </Pressable>
      </Pressable>
    );
  }

  function renderCrewCard(member: CrewMember) {
    const dotColor = member.status === 'on_site' ? semantic.success
      : member.status === 'late' ? semantic.warning
      : member.status === 'awaiting_confirmation' ? semantic.warning
      : member.status === 'completed' ? colors.textTertiary
      : colors.textTertiary;

    return (
      <Pressable
        key={member.personId}
        style={styles.crewCard}
        onPress={() => router.push(`/(owner)/workers/${member.personId}` as any)}
      >
        <View style={styles.crewAvatarWrap}>
          <Avatar
            firstName={member.person?.firstName ?? '?'}
            lastName={member.person?.lastName ?? '?'}
            size={64}
            uri={member.person?.avatarUrl}
          />
        </View>
        <View style={styles.crewNameRow}>
          <View style={[styles.crewDot, { backgroundColor: dotColor }]} />
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>
            {member.person?.firstName} {member.person?.lastName}
          </Text>
        </View>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
          {member.statusLabel}
        </Text>
        {member.timeLabel && (
          <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>
            {member.status === 'on_site' ? 'Since ' : member.status === 'awaiting_confirmation' ? 'Starts ' : ''}
            {member.timeLabel}
          </Text>
        )}
        {member.projectName && (
          <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>
            {member.projectName}
          </Text>
        )}
      </Pressable>
    );
  }

  function renderProjectCard(project: ProjectHomeSummary, index: number) {
    const statusIsOnSite = project.todayStatusLabel === 'Crew on site';
    return (
      <Pressable
        key={project.id}
        style={[styles.projectCard, { backgroundColor: colors.surface }, shadow.sm]}
        onPress={() => router.push(`/(owner)/projects/${project.id}` as any)}
      >
        <OptimizedImage
          source={PROJECT_IMAGES[index % PROJECT_IMAGES.length]}
          style={styles.projectImage}
        />
        <View style={styles.projectInfo}>
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 1 }]} numberOfLines={1}>
            {project.customer?.firstName} {project.customer?.lastName}
          </Text>
          <View style={styles.projectProgressRow}>
            <ProgressBar progress={project.progress} style={{ flex: 1 }} />
            <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
              {project.progress}%
            </Text>
          </View>
          <View style={styles.projectStatusRow}>
            {project.todayStatusLabel ? (
              statusIsOnSite ? (
                <View style={[styles.projectStatusDot, { backgroundColor: semantic.success }]} />
              ) : (
                <Icon name="clock" size={11} color={colors.textTertiary} />
              )
            ) : null}
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: project.todayStatusLabel ? spacing.xs : 0 }]} numberOfLines={1}>
              {project.todayStatusLabel ?? 'No crew scheduled'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              {getGreeting()},
            </Text>
            <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
              {user?.firstName ?? 'Owner'}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>
              {getTodayLabel()}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/(owner)/notification-center' as any)}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              hitSlop={6}
            >
              {({ pressed }) => (
                HAS_LIQUID_GLASS ? (
                  <GlassView glassEffectStyle="regular" isInteractive style={[styles.glassIconButton, pressed && styles.iconButtonPressed]}>
                    <Icon name="bell" size={19} color={colors.textPrimary} />
                  </GlassView>
                ) : (
                  <View style={[styles.smallIconButton, { backgroundColor: colors.backgroundTertiary }, pressed && styles.iconButtonPressed]}>
                    <Icon name="bell" size={19} color={colors.textPrimary} />
                  </View>
                )
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push('/(owner)/search' as any)}
              accessibilityRole="button"
              accessibilityLabel="Search"
              hitSlop={6}
            >
              {({ pressed }) => (
                HAS_LIQUID_GLASS ? (
                  <GlassView glassEffectStyle="regular" isInteractive style={[styles.glassIconButton, pressed && styles.iconButtonPressed]}>
                    <Icon name="search" size={19} color={colors.textPrimary} />
                  </GlassView>
                ) : (
                  <View style={[styles.smallIconButton, { backgroundColor: colors.backgroundTertiary }, pressed && styles.iconButtonPressed]}>
                    <Icon name="search" size={19} color={colors.textPrimary} />
                  </View>
                )
              )}
            </Pressable>
            <Pressable
              onPress={() => setQuickActionsOpen(true)}
              style={[styles.iconButton, { backgroundColor: colors.primarySurface }]}
              accessibilityRole="button"
              accessibilityLabel="Quick actions"
            >
              <Icon name="plus" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(owner)/more' as any)}
              accessibilityRole="button"
              accessibilityLabel="Profile and more"
            >
              <Avatar firstName={user?.firstName ?? ''} lastName={user?.lastName ?? ''} size={44} uri={user?.avatarUrl} />
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          {/* Today hero */}
          <View style={[styles.heroCard, shadow.md]}>
            <OptimizedImage source={HERO_IMAGE_URI} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(10,20,15,0.25)', 'rgba(8,16,12,0.85)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroContent}>
              <Text style={[typeScale.overline, { color: 'rgba(255,255,255,0.8)' }]}>TODAY</Text>
              <Text style={[typeScale.headingLarge, { color: '#FFFFFF', marginTop: 2, marginBottom: spacing.md }]}>
                {todayStats.jobsInProgress} job{todayStats.jobsInProgress === 1 ? '' : 's'} in progress
              </Text>
              <View style={styles.heroStatsRow}>
                {renderHeroStat(<Icon name="users" size={14} color="#FFFFFF" />, todayStats.workersScheduled, 'Workers scheduled')}
                {renderHeroStat(<View style={styles.onSiteDot} />, todayStats.onSite, 'On site')}
                {renderHeroStat(<Icon name="clock" size={14} color="#FFFFFF" />, todayStats.upcoming, 'Upcoming')}
                {renderHeroStat(<Icon name="alert-circle" size={14} color="#FF6B6B" />, attentionTotalCount, 'Needs attention')}
              </View>
              <Pressable
                style={styles.heroButton}
                onPress={() => router.push('/(owner)/more/schedule' as any)}
              >
                <Text style={[typeScale.labelLarge, { color: colors.primaryDark }]}>View Today's Schedule</Text>
                <Icon name="chevron-right" size={16} color={colors.primaryDark} />
              </Pressable>
            </View>
          </View>

          {/* Needs Attention */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>Needs Attention</Text>
                {attentionTotalCount > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: semantic.errorLight }]}>
                    <Text style={[typeScale.labelSmall, { color: semantic.error, fontWeight: '700' }]}>
                      {attentionTotalCount}
                    </Text>
                  </View>
                )}
              </View>
              {attentionTotalCount > 0 && (
                <Pressable onPress={() => router.push('/(owner)/notification-center' as any)}>
                  <Text style={[typeScale.labelSmall, { color: colors.primary }]}>See All</Text>
                </Pressable>
              )}
            </View>
            {attentionItems.length === 0 ? (
              <View style={[styles.emptyAttention, { backgroundColor: colors.backgroundSecondary }]}>
                <Icon name="check-circle" size={16} color={semantic.success} />
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                  Everything looks good — no issues need your attention right now.
                </Text>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {attentionItems.map(renderAttentionRow)}
              </View>
            )}
          </View>

          {/* Crew Today */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
                Crew Today <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>· {crewTodayTotal} scheduled</Text>
              </Text>
              <Pressable onPress={() => router.push('/(owner)/workers' as any)}>
                <Text style={[typeScale.labelSmall, { color: colors.primary }]}>View Team</Text>
              </Pressable>
            </View>
            {crewToday.length === 0 ? (
              <View style={[styles.emptyAttention, { backgroundColor: colors.backgroundSecondary }]}>
                <Icon name="users" size={16} color={colors.textTertiary} />
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                  No one is scheduled today.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crewRow}>
                {crewToday.map(renderCrewCard)}
                {crewTodayTotal > crewToday.length && (
                  <Pressable style={styles.crewMore} onPress={() => router.push('/(owner)/workers' as any)}>
                    <Text style={[typeScale.labelSmall, { color: colors.primary }]}>
                      +{crewTodayTotal - crewToday.length} more
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
          </View>

          {/* Active Projects */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
                Active Projects <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>· {activeProjectsTotal} total</Text>
              </Text>
              <Pressable onPress={() => router.push('/(owner)/projects' as any)}>
                <Text style={[typeScale.labelSmall, { color: colors.primary }]}>View All</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectsRow}>
              {activeProjects.map(renderProjectCard)}
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      {/* Quick Actions sheet */}
      <Modal visible={quickActionsOpen} transparent animationType="slide" onRequestClose={() => setQuickActionsOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setQuickActionsOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderLight }]} />
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md }]}>
              Quick Actions
            </Text>
            {QUICK_ACTIONS.map((action, i) => (
              <React.Fragment key={action.label}>
                <Pressable
                  style={styles.sheetOption}
                  onPress={() => { setQuickActionsOpen(false); router.push(action.route as any); }}
                >
                  <View style={[styles.sheetOptionIcon, { backgroundColor: colors.primarySurface }]}>
                    <Icon name={action.icon} size={18} color={colors.primary} />
                  </View>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginLeft: spacing.md }]}>
                    {action.label}
                  </Text>
                </Pressable>
                {i < QUICK_ACTIONS.length - 1 && <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />}
              </React.Fragment>
            ))}
            <Pressable
              style={[styles.cancelButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setQuickActionsOpen(false)}
            >
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: spacing['5xl'] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconButtonPressed: {
    opacity: 0.6,
  },
  content: { paddingHorizontal: spacing.lg },

  heroCard: {
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  heroStat: { alignItems: 'flex-start' },
  heroStatIconRow: { flexDirection: 'row', alignItems: 'center' },
  onSiteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: semantic.success,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },

  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  attentionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  emptyAttention: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
  },

  crewRow: { gap: spacing.xl, paddingRight: spacing.lg },
  crewCard: { width: 148, alignItems: 'flex-start' },
  crewAvatarWrap: { marginBottom: spacing.sm },
  crewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  crewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  crewMore: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },

  projectsRow: { gap: spacing.md, paddingRight: spacing.lg },
  projectCard: {
    width: 272,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  projectImage: { width: '100%', height: 130 },
  projectInfo: { padding: spacing.md },
  projectProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  projectStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  projectStatusDot: { width: 6, height: 6, borderRadius: 3 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  sheetOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth },
  cancelButton: {
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});
