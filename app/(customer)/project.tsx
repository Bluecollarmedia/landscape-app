import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { SectionTabs, ProgressBar, Card, EmptyState, StatusBadge, Button, OptimizedImage } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { db } from '@/data/store';
import { CustomerDocuments } from '@/components/financials/CustomerDocuments';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { semantic, brand } from '@/theme/colors';
import type { ProjectStatus, CustomerTimelineType, RequestCategory } from '@/types/project';

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'photos', label: 'Photos' },
  { key: 'requests', label: 'Requests' },
];

const statusConfig: Record<ProjectStatus, { label: string; type: 'success' | 'warning' | 'info' | 'neutral' }> = {
  prospect: { label: 'Quote', type: 'neutral' },
  active: { label: 'In Progress', type: 'success' },
  on_hold: { label: 'On Hold', type: 'warning' },
  completed: { label: 'Completed', type: 'info' },
  archived: { label: 'Archived', type: 'neutral' },
};

const timelineIcons: Record<CustomerTimelineType, keyof typeof Feather.glyphMap> = {
  update_shared: 'send',
  photo_shared: 'camera',
  progress_updated: 'trending-up',
  project_started: 'play-circle',
  project_completed: 'check-circle',
  request_responded: 'message-square',
};

const timelineColors: Record<CustomerTimelineType, string> = {
  update_shared: semantic.info,
  photo_shared: brand.primary,
  progress_updated: semantic.warning,
  project_started: semantic.success,
  project_completed: semantic.success,
  request_responded: semantic.info,
};

const categoryOptions: { key: RequestCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'question', label: 'Question', icon: 'help-circle' },
  { key: 'change_request', label: 'Change Request', icon: 'edit-3' },
  { key: 'additional_work', label: 'Additional Work', icon: 'plus-circle' },
  { key: 'other', label: 'Other', icon: 'more-horizontal' },
];

export default function CustomerProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState('overview');

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqCategory, setReqCategory] = useState<RequestCategory>('question');

  const { project, photos, customerTimeline, updates, requests, submitRequest, settings, taskStats } = useProject(id);

  const sharedPhotos = useMemo(
    () => photos.filter(p => p.isCustomerVisible),
    [photos],
  );

  const visibleUpdates = useMemo(
    () => updates.filter(u => u.isCustomerVisible),
    [updates],
  );

  const customerRequests = useMemo(
    () => requests.filter(r => r.requestedBy === user?.id),
    [requests, user?.id],
  );

  const isCompleted = project?.status === 'completed';
  const canSubmitRequests = !isCompleted && (settings?.customerInteractionEnabled ?? false);

  function handleSubmitRequest() {
    if (!reqTitle.trim()) return;
    submitRequest({ title: reqTitle.trim(), description: reqDescription.trim() || undefined, category: reqCategory });
    const companyName = db.company?.name ?? 'Brighton Lawn + Landscape';
    const sentMsg = `Your ${categoryOptions.find(c => c.key === reqCategory)?.label ?? reqCategory} has been sent to ${companyName}. They'll review it shortly.`;
    if (Platform.OS === 'web') alert(sentMsg);
    else Alert.alert('Request Submitted', sentMsg);
    setReqTitle('');
    setReqDescription('');
    setReqCategory('question');
    setShowRequestForm(false);
  }

  if (!project) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Project not found" />
      </View>
    );
  }

  // Narrowed copy: nested render functions below lose the `if (!project)` narrowing.
  const p = project;
  const config = statusConfig[p.status];

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function renderOverview() {
    return (
      <View style={styles.sectionContent}>
        {isCompleted && (
          <View style={[styles.completedBanner, { backgroundColor: semantic.successLight }]}>
            <Icon name="check-circle" size={18} color={semantic.success} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typeScale.bodySmall, { color: semantic.success, fontWeight: '600' }]}>Project Complete</Text>
              <Text style={[typeScale.caption, { color: semantic.success, marginTop: 2 }]}>
                This project has been completed. You can view photos, timeline, and updates.
              </Text>
            </View>
          </View>
        )}
        <CustomerDocuments projectId={p.id} />
        <Card>
          <View style={styles.progressSection}>
            <Text style={[typeScale.displayLarge, { color: colors.primary }]}>{p.progress}%</Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>complete</Text>
          </View>
          <ProgressBar progress={p.progress} height={10} style={{ marginTop: spacing.sm }} />
          <View style={{ marginTop: spacing.md }}>
            <StatusBadge label={config.label} status={config.type} />
          </View>
        </Card>

        <Card title="Project Details" style={{ marginTop: spacing.lg }}>
          {p.address && (
            <View style={styles.detailRow}>
              <Icon name="map-pin" size={16} color={colors.textTertiary} />
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                {p.address}{p.city ? `, ${p.city}` : ''}{p.state ? ` ${p.state}` : ''} {p.zip ?? ''}
              </Text>
            </View>
          )}
          {p.startDate && (
            <View style={styles.detailRow}>
              <Icon name="calendar" size={16} color={colors.textTertiary} />
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Started {formatDate(p.startDate)}
              </Text>
            </View>
          )}
          {p.estimatedEndDate && (
            <View style={styles.detailRow}>
              <Icon name="clock" size={16} color={colors.textTertiary} />
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Est. completion: {formatDate(p.estimatedEndDate)}
              </Text>
            </View>
          )}
          {p.completedAt && (
            <View style={styles.detailRow}>
              <Icon name="check-circle" size={16} color={semantic.success} />
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Completed {formatDate(p.completedAt)}
              </Text>
            </View>
          )}
        </Card>

        {visibleUpdates.length > 0 && (
          <Card title="Latest Update" style={{ marginTop: spacing.lg }}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
              {visibleUpdates[0].title}
            </Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {visibleUpdates[0].body}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.md }]}>
              {formatDateTime(visibleUpdates[0].createdAt)}
            </Text>
          </Card>
        )}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <Icon name="camera" size={18} color={colors.primary} />
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>{sharedPhotos.length}</Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Photos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <Icon name="send" size={18} color={colors.primary} />
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>{visibleUpdates.length}</Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Updates</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <Icon name="activity" size={18} color={colors.primary} />
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>{customerTimeline.length}</Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Events</Text>
          </View>
        </View>
      </View>
    );
  }

  function renderTimeline() {
    return (
      <View style={styles.sectionContent}>
        {customerTimeline.length === 0 ? (
          <EmptyState icon="activity" title="No updates yet" description="Project updates and milestones will appear here." />
        ) : (
          <View style={styles.timeline}>
            {customerTimeline.map((event, i) => (
              <View key={event.id} style={styles.timelineItem}>
                <View style={styles.timelineIconCol}>
                  <View style={[styles.timelineIcon, { backgroundColor: (timelineColors[event.eventType] ?? colors.primary) + '20' }]}>
                    <Icon
                      name={timelineIcons[event.eventType] ?? 'activity'}
                      size={14}
                      color={timelineColors[event.eventType] ?? colors.primary}
                    />
                  </View>
                  {i < customerTimeline.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.borderLight }]} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>
                    {event.title}
                  </Text>
                  {event.description && (
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      {event.description}
                    </Text>
                  )}
                  {event.photoUrl && (
                    <OptimizedImage
                      source={event.photoUrl}
                      style={[styles.timelinePhoto, { backgroundColor: colors.backgroundTertiary }]}
                    />
                  )}
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                    {formatDateTime(event.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderPhotos() {
    return (
      <View style={styles.sectionContent}>
        {sharedPhotos.length === 0 ? (
          <EmptyState icon="camera" title="No photos shared yet" description="Photos of your project will appear here as work progresses." />
        ) : (
          <View style={styles.photoGrid}>
            {sharedPhotos.map(photo => (
              <Card key={photo.id} style={styles.photoCard}>
                <OptimizedImage
                  source={photo.fileUrl}
                  style={[styles.photoImage, { backgroundColor: colors.backgroundTertiary }]}
                />
                <View style={{ padding: spacing.md }}>
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                    {photo.customerDescription ?? photo.caption ?? 'Project photo'}
                  </Text>
                  {photo.taskTitle && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
                      <Icon name="check-square" size={12} color={colors.textTertiary} />
                      <Text style={[typeScale.caption, { color: colors.textTertiary, marginLeft: 4 }]}>
                        {photo.taskTitle}
                      </Text>
                    </View>
                  )}
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                    {formatDateTime(photo.sharedAt ?? photo.createdAt)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderRequests() {
    const statusLabel: Record<string, { label: string; type: 'success' | 'warning' | 'info' | 'neutral' | 'error' }> = {
      pending: { label: 'Pending', type: 'warning' },
      acknowledged: { label: 'Acknowledged', type: 'info' },
      completed: { label: 'Completed', type: 'success' },
      declined: { label: 'Declined', type: 'error' },
      converted: { label: 'In Progress', type: 'success' },
    };

    return (
      <View style={styles.sectionContent}>
        {canSubmitRequests && !showRequestForm && (
          <Button
            title="New Request"
            onPress={() => setShowRequestForm(true)}
            variant="primary"
            fullWidth
            icon="plus"
            style={{ marginBottom: spacing.lg }}
          />
        )}

        {canSubmitRequests && showRequestForm && (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              Submit a Request
            </Text>

            <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Category
            </Text>
            <View style={styles.categoryGrid}>
              {categoryOptions.map(cat => {
                const selected = reqCategory === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setReqCategory(cat.key)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selected ? colors.primary + '15' : colors.backgroundTertiary,
                        borderColor: selected ? colors.primary : colors.borderLight,
                      },
                    ]}
                  >
                    <Icon name={cat.icon} size={14} color={selected ? colors.primary : colors.textTertiary} />
                    <Text style={[typeScale.caption, { color: selected ? colors.primary : colors.textSecondary, fontWeight: selected ? '600' : '400' }]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md }]}>
              Title
            </Text>
            <TextInput
              value={reqTitle}
              onChangeText={setReqTitle}
              placeholder="Brief summary of your request"
              placeholderTextColor={colors.textTertiary}
              style={[styles.formInput, { color: colors.textPrimary, backgroundColor: colors.backgroundTertiary, borderColor: colors.borderLight }]}
            />

            <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md }]}>
              Details (optional)
            </Text>
            <TextInput
              value={reqDescription}
              onChangeText={setReqDescription}
              placeholder="Add any details or context..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              style={[styles.formInput, styles.formTextarea, { color: colors.textPrimary, backgroundColor: colors.backgroundTertiary, borderColor: colors.borderLight }]}
            />

            <View style={styles.formActions}>
              <Button title="Cancel" onPress={() => { setShowRequestForm(false); setReqTitle(''); setReqDescription(''); }} variant="secondary" style={{ flex: 1 }} />
              <Button title="Submit" onPress={handleSubmitRequest} variant="primary" style={{ flex: 1 }} icon="send" />
            </View>
          </Card>
        )}

        {customerRequests.length === 0 && !showRequestForm ? (
          <EmptyState icon="message-circle" title="No requests yet" description={canSubmitRequests ? 'Tap "New Request" to submit a question or change request.' : 'Requests you submit will appear here.'} />
        ) : (
          customerRequests.map(req => {
            const badge = statusLabel[req.status] ?? { label: req.status, type: 'neutral' as const };
            return (
              <Card key={req.id} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]}>{req.title}</Text>
                  <StatusBadge label={badge.label} status={badge.type} />
                </View>
                {req.description && (
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                    {req.description}
                  </Text>
                )}
                {req.responseNote && (
                  <View style={[styles.responseBox, { backgroundColor: colors.primarySurface }]}>
                    <Text style={[typeScale.caption, { color: colors.primary, fontWeight: '600' }]}>Response from Brighton Lawn</Text>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                      {req.responseNote}
                    </Text>
                  </View>
                )}
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.md }]}>
                  Submitted {formatDateTime(req.createdAt)}
                </Text>
              </Card>
            );
          })
        )}
      </View>
    );
  }

  const activeSections = isCompleted
    ? SECTIONS.filter(s => s.key !== 'requests')
    : (settings?.customerInteractionEnabled ? SECTIONS : SECTIONS.filter(s => s.key !== 'requests'));

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    overview: renderOverview,
    timeline: renderTimeline,
    photos: renderPhotos,
    requests: renderRequests,
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]} numberOfLines={1}>
              {p.name}
            </Text>
          </View>
        </View>
      </View>

      <SectionTabs tabs={activeSections} activeTab={activeSection} onTabChange={setActiveSection} />

      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {sectionRenderers[activeSection]?.()}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingBottom: spacing['5xl'],
  },
  sectionContent: {
    padding: spacing.lg,
  },

  // Overview
  progressSection: {
    alignItems: 'center',
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },

  // Timeline
  timeline: {
    paddingLeft: spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineIconCol: {
    width: 32,
    alignItems: 'center',
  },
  timelineIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: spacing.xs,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.md,
    paddingBottom: spacing.lg,
  },
  timelinePhoto: {
    width: '100%',
    height: 140,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },

  // Photos
  photoGrid: {
    gap: spacing.md,
  },
  photoCard: {
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: 180,
  },

  // Requests
  responseBox: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  formInput: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typeScale.bodySmall.fontSize,
  },
  formTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
});
