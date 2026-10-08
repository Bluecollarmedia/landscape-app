import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { EmptyState } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import type { Assignment } from '@/types/schedule';
import { localDateKey } from '@/lib/ids';

// Temporary placeholders — swap for real per-project photos once available.
const THUMBNAIL_URIS = [
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=300&q=70',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&q=70',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=300&q=70',
];

function getProjectThumbnail(projectId?: string): string {
  if (!projectId) return THUMBNAIL_URIS[0];
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) hash = (hash + projectId.charCodeAt(i)) % THUMBNAIL_URIS.length;
  return THUMBNAIL_URIS[hash];
}

function formatTime(time?: string) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = new Date(today);
  y.setDate(y.getDate() - 1);

  const iso = (x: Date) => localDateKey(x);
  if (dateStr === iso(today)) return 'Today';
  if (dateStr === iso(tomorrow)) return 'Tomorrow';
  if (dateStr === iso(y)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDate(assignments: Assignment[]) {
  const groups: { date: string; items: Assignment[] }[] = [];
  for (const a of assignments) {
    const last = groups[groups.length - 1];
    if (last && last.date === a.scheduledDate) {
      last.items.push(a);
    } else {
      groups.push({ date: a.scheduledDate, items: [a] });
    }
  }
  return groups;
}

function JobCard({ assignment, onPress }: { assignment: Assignment; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.jobCard, { backgroundColor: colors.surface }, shadow.sm]} onPress={onPress}>
      <Image source={{ uri: getProjectThumbnail(assignment.projectId) }} style={styles.thumb} resizeMode="cover" />
      <View style={styles.jobInfo}>
        <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]} numberOfLines={1}>
          {assignment.project?.name ?? 'Unknown Project'}
        </Text>
        <View style={styles.metaRow}>
          <Feather name="clock" size={12} color={colors.textTertiary} />
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
            {assignment.isFullDay ? 'Full day' : `${formatTime(assignment.startTime)} – ${formatTime(assignment.endTime)}`}
          </Text>
        </View>
        {assignment.project?.address && (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={colors.textTertiary} />
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: 4 }]} numberOfLines={1}>
              {assignment.project.address}
            </Text>
          </View>
        )}
        {assignment.truck && (
          <View style={styles.metaRow}>
            <Feather name="truck" size={12} color={colors.textTertiary} />
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              {assignment.truck.name}
            </Text>
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function WorkerJobsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const router = useRouter();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { upcomingAssignments, completedAssignments } = useWorkerContext();

  const data = tab === 'upcoming' ? upcomingAssignments : completedAssignments;
  const groups = groupByDate(data);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <Image
          source={{ uri: THUMBNAIL_URIS[0] }}
          style={[styles.heroImage, { opacity: 0.16 }]}
          resizeMode="cover"
        />
        <View style={[styles.headerContent, { paddingTop: insets.top + spacing.md }]}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>My Jobs</Text>
          <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
            Your upcoming and past assignments
          </Text>
        </View>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          values={['Upcoming', 'Past']}
          selectedIndex={tab === 'upcoming' ? 0 : 1}
          onChange={(event) => setTab(event.nativeEvent.selectedSegmentIndex === 0 ? 'upcoming' : 'past')}
          tintColor={colors.primary}
          appearance="light"
          backgroundColor={colors.groupedBackground}
          fontStyle={{ color: colors.textSecondary }}
          activeFontStyle={{ color: '#FFFFFF', fontWeight: '600' }}
          style={styles.segmentControl}
        />
      </View>

      {data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="clipboard"
            title={tab === 'upcoming' ? 'No upcoming jobs' : 'No past jobs yet'}
            description="Your assigned jobs will appear here."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]} showsVerticalScrollIndicator={false}>
          {groups.map(group => (
            <View key={group.date} style={styles.dateGroup}>
              <View style={styles.dateHeaderRow}>
                <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
                  {formatDateHeading(group.date)}
                </Text>
                <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>
                  {group.items.length} job{group.items.length > 1 ? 's' : ''}
                </Text>
              </View>
              {group.items.map(a => (
                <JobCard key={a.id} assignment={a} onPress={() => router.push(`/(worker)/job/${a.id}` as any)} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { overflow: 'hidden' },
  heroImage: { position: 'absolute', width: '100%', height: '100%' },
  headerContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  segmentWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  segmentControl: {
    height: 36,
  },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] },
  dateGroup: { marginBottom: spacing.lg },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md },
  jobInfo: { flex: 1, marginLeft: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
});
