import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TextInput, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { SectionTabs, StatusBadge, ProgressBar, Card, EmptyState, Divider, Avatar, Button, OptimizedImage } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { useSchedule } from '@/hooks/useSchedule';
import { useCustomerAccess } from '@/hooks/useCustomerAccess';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import type { ProjectStatus, TaskStatus, HistoryEventType, ProjectPhoto } from '@/types/project';

const today = new Date().toISOString().split('T')[0];

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'People' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'photos', label: 'Photos' },
  { key: 'updates', label: 'Updates' },
  { key: 'requests', label: 'Requests' },
  { key: 'activity', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
];

const statusConfig: Record<ProjectStatus, { label: string; type: 'success' | 'warning' | 'info' | 'neutral' }> = {
  active: { label: 'Active', type: 'success' },
  on_hold: { label: 'On Hold', type: 'warning' },
  completed: { label: 'Completed', type: 'info' },
  archived: { label: 'Archived', type: 'neutral' },
};

const taskStatusConfig: Record<TaskStatus, { label: string; type: 'success' | 'warning' | 'neutral' }> = {
  completed: { label: 'Done', type: 'success' },
  in_progress: { label: 'In Progress', type: 'warning' },
  pending: { label: 'To Do', type: 'neutral' },
};

const historyIcons: Record<string, keyof typeof Feather.glyphMap> = {
  project_created: 'plus-circle',
  status_changed: 'flag',
  progress_updated: 'trending-up',
  team_member_added: 'user-plus',
  team_member_removed: 'user-minus',
  task_created: 'plus-square',
  task_completed: 'check-square',
  photo_added: 'camera',
  update_posted: 'send',
  request_created: 'message-circle',
  request_responded: 'message-square',
  settings_changed: 'settings',
  note_added: 'file-text',
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState('overview');

  const { project, tasks, team, settings, history, updates, requests, photos, photoStats, taskStats } = useProject(id);
  const schedule = useSchedule();
  const customerAccess = useCustomerAccess();
  const [reviewPhoto, setReviewPhoto] = useState<ProjectPhoto | null>(null);
  const [customerDesc, setCustomerDesc] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateBody, setUpdateBody] = useState('');
  const [updateVisible, setUpdateVisible] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [accessVersion, setAccessVersion] = useState(0);

  if (!project) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Project not found" />
      </View>
    );
  }

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
        <Card title="Progress">
          <View style={styles.progressRow}>
            <Text style={[typeScale.displayLarge, { color: colors.primary }]}>{p.progress}%</Text>
            <StatusBadge label={config.label} status={config.type} />
          </View>
          <ProgressBar progress={p.progress} height={8} style={{ marginTop: spacing.md }} />
        </Card>

        <Card title="Details" style={{ marginTop: spacing.lg }}>
          {p.customer && (
            <DetailRow icon="user" label="Customer" value={`${p.customer.firstName} ${p.customer.lastName}`} colors={colors} />
          )}
          {p.address && (
            <DetailRow icon="map-pin" label="Address" value={`${p.address}${p.city ? `, ${p.city}` : ''}${p.state ? ` ${p.state}` : ''} ${p.zip ?? ''}`} colors={colors} />
          )}
          {p.startDate && (
            <DetailRow icon="calendar" label="Start Date" value={formatDate(p.startDate)} colors={colors} />
          )}
          {p.estimatedEndDate && (
            <DetailRow icon="clock" label="Est. Completion" value={formatDate(p.estimatedEndDate)} colors={colors} />
          )}
          {p.completedAt && (
            <DetailRow icon="check-circle" label="Completed" value={formatDate(p.completedAt)} colors={colors} />
          )}
        </Card>

        <View style={styles.statsRow}>
          <StatCard label="Team" value={team.length.toString()} icon="users" colors={colors} />
          <StatCard label="Tasks" value={`${taskStats.completed}/${taskStats.total}`} icon="check-square" colors={colors} />
          <StatCard label="Photos" value={photoStats.total.toString()} icon="camera" colors={colors} />
        </View>

        {p.notes && (
          <Card title="Internal Notes" style={{ marginTop: spacing.lg }}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              {p.notes}
            </Text>
          </Card>
        )}
      </View>
    );
  }

  function renderPeople() {
    return (
      <View style={styles.sectionContent}>
        {p.customer && (
          <Card title="Customer" style={{ marginBottom: spacing.lg }}>
            <PersonRow person={p.customer} role="Customer" colors={colors} />
          </Card>
        )}
        <Card title={`Project Team (${team.length})`}>
          {team.length === 0 ? (
            <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>No team members assigned</Text>
          ) : (
            team.map((member, i) => (
              <View key={member.id}>
                {i > 0 && <Divider style={{ marginVertical: spacing.md }} />}
                <PersonRow person={member.person!} role="Worker" colors={colors} />
              </View>
            ))
          )}
        </Card>
      </View>
    );
  }

  function renderTasks() {
    return (
      <View style={styles.sectionContent}>
        <View style={styles.taskStatsHeader}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
            {taskStats.completed} of {taskStats.total} tasks completed
          </Text>
          <ProgressBar
            progress={taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0}
            height={4}
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {tasks.length === 0 ? (
          <EmptyState icon="check-square" title="No tasks yet" description="Tasks will appear here as they're added to this project." />
        ) : (
          tasks.map((task) => {
            const tc = taskStatusConfig[task.status];
            return (
              <View key={task.id} style={[styles.taskItem, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.taskCheckbox}>
                  <Feather
                    name={task.status === 'completed' ? 'check-circle' : 'circle'}
                    size={20}
                    color={task.status === 'completed' ? '#43A047' : colors.textTertiary}
                  />
                </View>
                <View style={styles.taskContent}>
                  <Text
                    style={[
                      typeScale.bodySmall,
                      { color: task.status === 'completed' ? colors.textTertiary : colors.textPrimary },
                      task.status === 'completed' && styles.taskCompleted,
                    ]}
                  >
                    {task.title}
                  </Text>
                  {task.assignee && (
                    <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                      {task.assignee.firstName} {task.assignee.lastName}
                    </Text>
                  )}
                </View>
                <StatusBadge label={tc.label} status={tc.type} />
              </View>
            );
          })
        )}
      </View>
    );
  }

  function openPhotoReview(photo: ProjectPhoto) {
    setCustomerDesc(photo.customerDescription ?? '');
    setReviewPhoto(photo);
  }

  function handleSharePhoto() {
    if (!reviewPhoto) return;
    const idx = photos.findIndex(ph => ph.id === reviewPhoto.id);
    if (idx !== -1) {
      photos[idx].isCustomerVisible = true;
      photos[idx].customerDescription = customerDesc;
      photos[idx].sharedBy = 'owner1';
      photos[idx].sharedAt = new Date().toISOString();
    }
    setReviewPhoto(null);
  }

  function handleUnsharePhoto() {
    if (!reviewPhoto) return;
    const idx = photos.findIndex(ph => ph.id === reviewPhoto.id);
    if (idx !== -1) {
      photos[idx].isCustomerVisible = false;
      photos[idx].sharedBy = undefined;
      photos[idx].sharedAt = undefined;
    }
    setReviewPhoto(null);
  }

  function renderPhotos() {
    const taskGroups = new Map<string, ProjectPhoto[]>();
    const ungrouped: ProjectPhoto[] = [];

    photos.forEach(photo => {
      if (photo.taskTitle || photo.taskId) {
        const key = photo.taskTitle ?? photo.taskId ?? 'Unknown Task';
        if (!taskGroups.has(key)) taskGroups.set(key, []);
        taskGroups.get(key)!.push(photo);
      } else {
        ungrouped.push(photo);
      }
    });

    const photoTypeLabel: Record<string, string> = {
      before: 'Before', after: 'After', progress: 'Progress', issue: 'Issue', general: 'General',
    };

    return (
      <View style={styles.sectionContent}>
        <View style={styles.photoStatsBar}>
          <View style={[styles.photoStat, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={[typeScale.headingMedium, { color: colors.textPrimary }]}>{photoStats.total}</Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Total</Text>
          </View>
          <View style={[styles.photoStat, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={[typeScale.headingMedium, { color: colors.primary }]}>{photoStats.shared}</Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Shared</Text>
          </View>
          <View style={[styles.photoStat, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={[typeScale.headingMedium, { color: colors.warning ?? '#F9A825' }]}>{photoStats.unreviewed}</Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Internal</Text>
          </View>
        </View>

        {photos.length === 0 ? (
          <EmptyState icon="camera" title="No photos yet" description="Worker-uploaded photos will appear here for review." />
        ) : (
          <>
            {Array.from(taskGroups.entries()).map(([taskName, taskPhotos]) => (
              <View key={taskName} style={{ marginBottom: spacing.lg }}>
                <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                  {taskName}
                </Text>
                <View style={styles.photoGrid}>
                  {taskPhotos.map(photo => (
                    <Pressable
                      key={photo.id}
                      style={[styles.photoCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                      onPress={() => openPhotoReview(photo)}
                    >
                      <OptimizedImage source={photo.fileUrl} style={styles.photoThumb} placeholder={photo.blurhash} />
                      <View style={styles.photoCardInfo}>
                        <View style={styles.photoCardBadges}>
                          <View style={[styles.photoTypeBadge, { backgroundColor: colors.backgroundTertiary }]}>
                            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                              {photoTypeLabel[photo.photoType] ?? photo.photoType}
                            </Text>
                          </View>
                          {photo.isCustomerVisible ? (
                            <View style={[styles.photoTypeBadge, { backgroundColor: colors.primarySurface }]}>
                              <Feather name="eye" size={10} color={colors.primary} />
                              <Text style={[typeScale.caption, { color: colors.primary, marginLeft: 2 }]}>Shared</Text>
                            </View>
                          ) : (
                            <View style={[styles.photoTypeBadge, { backgroundColor: colors.backgroundTertiary }]}>
                              <Feather name="eye-off" size={10} color={colors.textTertiary} />
                              <Text style={[typeScale.caption, { color: colors.textTertiary, marginLeft: 2 }]}>Internal</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                          {photo.caption}
                        </Text>
                        <Text style={[typeScale.caption, { color: colors.textTertiary, fontSize: 10 }]}>
                          {photo.uploader ? `${photo.uploader.firstName} ${photo.uploader.lastName}` : 'Unknown'}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            {ungrouped.length > 0 && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                  General
                </Text>
                <View style={styles.photoGrid}>
                  {ungrouped.map(photo => (
                    <Pressable
                      key={photo.id}
                      style={[styles.photoCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                      onPress={() => openPhotoReview(photo)}
                    >
                      <OptimizedImage source={photo.fileUrl} style={styles.photoThumb} placeholder={photo.blurhash} />
                      <View style={styles.photoCardInfo}>
                        <View style={styles.photoCardBadges}>
                          <View style={[styles.photoTypeBadge, { backgroundColor: colors.backgroundTertiary }]}>
                            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                              {photoTypeLabel[photo.photoType] ?? photo.photoType}
                            </Text>
                          </View>
                          {photo.isCustomerVisible ? (
                            <View style={[styles.photoTypeBadge, { backgroundColor: colors.primarySurface }]}>
                              <Feather name="eye" size={10} color={colors.primary} />
                              <Text style={[typeScale.caption, { color: colors.primary, marginLeft: 2 }]}>Shared</Text>
                            </View>
                          ) : (
                            <View style={[styles.photoTypeBadge, { backgroundColor: colors.backgroundTertiary }]}>
                              <Feather name="eye-off" size={10} color={colors.textTertiary} />
                              <Text style={[typeScale.caption, { color: colors.textTertiary, marginLeft: 2 }]}>Internal</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                          {photo.caption}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </View>
    );
  }

  function handlePostUpdate() {
    if (!updateTitle.trim()) return;
    const newUpdate = {
      id: `u${Date.now()}`, projectId: id, createdBy: 'owner1',
      title: updateTitle.trim(), body: updateBody.trim(),
      isCustomerVisible: updateVisible,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      author: { id: 'owner1', firstName: 'Joey', lastName: 'Angeloco', email: 'joey@brightonlawn.com' },
    };
    updates.unshift(newUpdate);
    setUpdateTitle('');
    setUpdateBody('');
    setUpdateVisible(true);
    setShowComposer(false);
  }

  function renderUpdates() {
    return (
      <View style={styles.sectionContent}>
        {showComposer ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              New Update
            </Text>
            <TextInput
              style={[styles.composerInput, { backgroundColor: colors.surface, borderColor: colors.borderLight, color: colors.textPrimary }]}
              value={updateTitle}
              onChangeText={setUpdateTitle}
              placeholder="Update title"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.composerInput, styles.composerBody, { backgroundColor: colors.surface, borderColor: colors.borderLight, color: colors.textPrimary }]}
              value={updateBody}
              onChangeText={setUpdateBody}
              placeholder="What's the latest on this project?"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
            />
            <Pressable
              style={styles.visibilityToggle}
              onPress={() => setUpdateVisible(!updateVisible)}
            >
              <Feather name={updateVisible ? 'eye' : 'eye-off'} size={16} color={updateVisible ? colors.primary : colors.textTertiary} />
              <Text style={[typeScale.bodySmall, { color: updateVisible ? colors.primary : colors.textSecondary, marginLeft: spacing.sm }]}>
                {updateVisible ? 'Visible to customer' : 'Internal only'}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button title="Cancel" onPress={() => setShowComposer(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Post Update" onPress={handlePostUpdate} variant="primary" icon="send" style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Button
            title="New Update"
            onPress={() => setShowComposer(true)}
            variant="primary"
            icon="plus"
            fullWidth
            style={{ marginBottom: spacing.lg }}
          />
        )}

        {updates.length === 0 ? (
          <EmptyState icon="send" title="No updates yet" description="Updates posted to the customer will appear here." />
        ) : (
          updates.map((update) => (
            <Card key={update.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.updateHeader}>
                <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]}>{update.title}</Text>
                {update.isCustomerVisible ? (
                  <View style={[styles.visibleBadge, { backgroundColor: colors.primarySurface }]}>
                    <Feather name="eye" size={11} color={colors.primary} />
                    <Text style={[typeScale.caption, { color: colors.primary }]}>Visible</Text>
                  </View>
                ) : (
                  <View style={[styles.visibleBadge, { backgroundColor: colors.backgroundTertiary }]}>
                    <Feather name="eye-off" size={11} color={colors.textTertiary} />
                    <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Internal</Text>
                  </View>
                )}
              </View>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                {update.body}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.md }]}>
                {update.author ? `${update.author.firstName} ${update.author.lastName}` : 'Unknown'} · {formatDateTime(update.createdAt)}
              </Text>
            </Card>
          ))
        )}
      </View>
    );
  }

  function handleRequestAction(reqId: string, action: 'acknowledged' | 'declined' | 'converted') {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;
    req.status = action;
    req.respondedAt = new Date().toISOString();
    req.responseNote = responseNote.trim() || undefined;
    setRespondingTo(null);
    setResponseNote('');
  }

  function renderRequests() {
    const statusBadge = (status: string) => {
      switch (status) {
        case 'completed': return { label: 'Completed', status: 'success' as const };
        case 'declined': return { label: 'Declined', status: 'error' as const };
        case 'acknowledged': return { label: 'Acknowledged', status: 'info' as const };
        case 'converted': return { label: 'Converted', status: 'success' as const };
        default: return { label: 'Pending', status: 'warning' as const };
      }
    };

    const categoryLabel: Record<string, string> = {
      change_request: 'Change Request',
      question: 'Question',
      additional_work: 'Additional Work',
      other: 'Other',
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const otherRequests = requests.filter(r => r.status !== 'pending');

    return (
      <View style={styles.sectionContent}>
        {requests.length === 0 ? (
          <EmptyState icon="message-circle" title="No requests" description="Customer requests will appear here." />
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={[typeScale.labelSmall, { color: colors.warning ?? '#F9A825', marginBottom: spacing.sm }]}>
                  {pendingRequests.length} pending review
                </Text>
                {pendingRequests.map((req) => {
                  const badge = statusBadge(req.status);
                  const isResponding = respondingTo === req.id;
                  return (
                    <Card key={req.id} style={{ marginBottom: spacing.md }}>
                      <View style={styles.updateHeader}>
                        <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]}>{req.title}</Text>
                        <StatusBadge label={badge.label} status={badge.status} />
                      </View>
                      <View style={[styles.photoTypeBadge, { backgroundColor: colors.backgroundTertiary, alignSelf: 'flex-start', marginTop: spacing.xs }]}>
                        <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                          {categoryLabel[req.category] ?? req.category}
                        </Text>
                      </View>
                      {req.description && (
                        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                          {req.description}
                        </Text>
                      )}
                      <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.md }]}>
                        {req.requester ? `${req.requester.firstName} ${req.requester.lastName}` : 'Customer'} · {formatDateTime(req.createdAt)}
                      </Text>

                      {isResponding ? (
                        <View style={{ marginTop: spacing.md }}>
                          <TextInput
                            style={[styles.composerInput, { backgroundColor: colors.surface, borderColor: colors.borderLight, color: colors.textPrimary }]}
                            value={responseNote}
                            onChangeText={setResponseNote}
                            placeholder="Add a response note (optional)"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                          />
                          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                            <Button title="Acknowledge" onPress={() => handleRequestAction(req.id, 'acknowledged')} variant="primary" size="sm" icon="check" style={{ flex: 1 }} />
                            <Button title="Decline" onPress={() => handleRequestAction(req.id, 'declined')} variant="secondary" size="sm" icon="x" style={{ flex: 1 }} />
                          </View>
                          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                            <Button title="Convert to Task" onPress={() => handleRequestAction(req.id, 'converted')} variant="secondary" size="sm" icon="plus-square" style={{ flex: 1 }} />
                            <Button title="Cancel" onPress={() => { setRespondingTo(null); setResponseNote(''); }} variant="secondary" size="sm" style={{ flex: 1 }} />
                          </View>
                        </View>
                      ) : (
                        <Button
                          title="Respond"
                          onPress={() => { setRespondingTo(req.id); setResponseNote(''); }}
                          variant="secondary"
                          size="sm"
                          icon="message-square"
                          style={{ marginTop: spacing.md }}
                        />
                      )}
                    </Card>
                  );
                })}
              </View>
            )}

            {otherRequests.map((req) => {
              const badge = statusBadge(req.status);
              return (
                <Card key={req.id} style={{ marginBottom: spacing.md }}>
                  <View style={styles.updateHeader}>
                    <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]}>{req.title}</Text>
                    <StatusBadge label={badge.label} status={badge.status} />
                  </View>
                  <View style={[styles.photoTypeBadge, { backgroundColor: colors.backgroundTertiary, alignSelf: 'flex-start', marginTop: spacing.xs }]}>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                      {categoryLabel[req.category] ?? req.category}
                    </Text>
                  </View>
                  {req.description && (
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                      {req.description}
                    </Text>
                  )}
                  {req.responseNote && (
                    <View style={[styles.responseBox, { backgroundColor: colors.primarySurface }]}>
                      <Text style={[typeScale.caption, { color: colors.primary, fontWeight: '600' }]}>Response</Text>
                      <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                        {req.responseNote}
                      </Text>
                    </View>
                  )}
                  {req.linkedTaskId && (
                    <View style={[styles.reviewMetaRow, { marginTop: spacing.sm }]}>
                      <Feather name="link" size={12} color={colors.primary} />
                      <Text style={[typeScale.caption, { color: colors.primary, marginLeft: spacing.xs }]}>
                        Linked to task
                      </Text>
                    </View>
                  )}
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.md }]}>
                    {req.requester ? `${req.requester.firstName} ${req.requester.lastName}` : 'Customer'} · {formatDateTime(req.createdAt)}
                  </Text>
                </Card>
              );
            })}
          </>
        )}
      </View>
    );
  }

  function renderActivity() {
    return (
      <View style={styles.sectionContent}>
        {history.length === 0 ? (
          <EmptyState icon="activity" title="No activity" description="Project history will appear here as things happen." />
        ) : (
          <View style={styles.timeline}>
            {history.map((entry, i) => (
              <View key={entry.id} style={styles.timelineItem}>
                <View style={styles.timelineIconCol}>
                  <View style={[styles.timelineIcon, { backgroundColor: colors.backgroundTertiary }]}>
                    <Feather
                      name={historyIcons[entry.eventType] ?? 'activity'}
                      size={14}
                      color={colors.textTertiary}
                    />
                  </View>
                  {i < history.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.borderLight }]} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{entry.description}</Text>
                  <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                    {entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : 'System'} · {formatDateTime(entry.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  function handleCopyCode(code: string) {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(code);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function handleRevokeAccess() {
    if (Platform.OS === 'web') {
      if (!confirm('Revoke customer access? The customer will no longer be able to view this project. A new code will be generated.')) return;
    }
    await customerAccess.revokeAccess(p.id);
    setAccessVersion((v) => v + 1);
  }

  async function handleRegenerateCode() {
    if (Platform.OS === 'web') {
      if (!confirm('Generate a new code? The old code will stop working and any existing claim will be removed.')) return;
    }
    await customerAccess.regenerateCode(p.id);
    setAccessVersion((v) => v + 1);
  }

  function renderSettings() {
    if (!settings) {
      return (
        <View style={styles.sectionContent}>
          <EmptyState icon="settings" title="No settings" description="Default settings are in use for this project." />
        </View>
      );
    }

    const access = customerAccess.getAccessForProject(p.id);

    return (
      <View style={styles.sectionContent}>
        {/* Customer Access Card */}
        {access && access.code ? (
          <Card title="Customer Access" style={{ marginBottom: spacing.lg }}>
            <View style={styles.settingRow}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>Project Code</Text>
              <Pressable
                onPress={() => handleCopyCode(access.code)}
                style={[styles.codeChip, { backgroundColor: colors.surfacePressed }]}
              >
                <Text style={[typeScale.labelSmall, { color: colors.textPrimary, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, letterSpacing: 1 }]}>
                  {access.code}
                </Text>
                <Feather name={codeCopied ? 'check' : 'copy'} size={14} color={codeCopied ? semantic.success : colors.textSecondary} style={{ marginLeft: spacing.xs }} />
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>Status</Text>
              {access.claimedBy ? (
                <StatusBadge label="Claimed" status="success" />
              ) : (
                <StatusBadge label="Unclaimed" status="warning" />
              )}
            </View>

            {access.claimedBy && (
              <>
                <View style={styles.settingRow}>
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>Customer Email</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{access.claimedByEmail ?? 'Unknown'}</Text>
                </View>
                <View style={styles.settingRow}>
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>Claimed</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                    {access.claimedAt ? new Date(access.claimedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </Text>
                </View>

                <Pressable
                  onPress={handleRevokeAccess}
                  style={[styles.dangerBtn, { borderColor: semantic.error }]}
                >
                  <Feather name="user-x" size={14} color={semantic.error} />
                  <Text style={[typeScale.labelSmall, { color: semantic.error, marginLeft: spacing.xs }]}>
                    Revoke Access
                  </Text>
                </Pressable>
              </>
            )}

            {!access.claimedBy && (
              <Pressable
                onPress={handleRegenerateCode}
                style={[styles.outlineBtn, { borderColor: colors.border }]}
              >
                <Feather name="refresh-cw" size={14} color={colors.textSecondary} />
                <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                  Regenerate Code
                </Text>
              </Pressable>
            )}
          </Card>
        ) : null}

        <Card title="Customer Interaction">
          <SettingRow label="Customer interaction enabled" value={settings.customerInteractionEnabled} colors={colors} />
          <SettingRow label="Customer can submit requests" value={settings.customerCanRequest} colors={colors} />
          <SettingRow label="Customer can view photos" value={settings.customerCanViewPhotos} colors={colors} />
        </Card>
        <Card title="Work Requirements" style={{ marginTop: spacing.lg }}>
          <SettingRow label="Completion photo required" value={settings.completionPhotoRequired} colors={colors} />
          {settings.checkinRadiusMeters && (
            <View style={styles.settingRow}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>Check-in radius</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{settings.checkinRadiusMeters}m</Text>
            </View>
          )}
        </Card>
      </View>
    );
  }

  function renderSchedule() {
    const projectAssignments = schedule.getByProject(p.id, today);
    const tomorrowAssignments = schedule.getByProject(p.id, (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })());

    const confirmBadge = (state: string) => {
      if (state === 'confirmed') return { label: 'Confirmed', status: 'success' as const };
      if (state === 'awaiting') return { label: 'Awaiting', status: 'warning' as const };
      return { label: 'Not Sent', status: 'neutral' as const };
    };

    return (
      <View style={styles.sectionContent}>
        <Card title="Today's Schedule">
          {projectAssignments.length === 0 ? (
            <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>No workers scheduled today</Text>
          ) : (
            projectAssignments.map((a) => {
              const timeStr = a.isFullDay ? 'Full Day' : `${a.startTime}–${a.endTime}`;
              const badge = confirmBadge(a.confirmationState);
              return (
                <View key={a.id} style={[styles.scheduleRow, { borderBottomColor: colors.borderLight }]}>
                  <Avatar firstName={a.person?.firstName ?? '?'} lastName={a.person?.lastName ?? '?'} size={32} uri={a.person?.avatarUrl} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '500' }]}>
                      {a.person?.firstName} {a.person?.lastName}
                    </Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                      {timeStr}{a.truck ? ` · ${a.truck.name}` : ''}
                    </Text>
                  </View>
                  <StatusBadge label={badge.label} status={badge.status} />
                </View>
              );
            })
          )}
          <View style={{ marginTop: spacing.sm }}>
            <Button
              title="Schedule Worker"
              onPress={() => router.push(`/(owner)/more/schedule-create?projectId=${p.id}&date=${today}` as any)}
              variant="secondary"
              size="sm"
              icon="plus"
            />
          </View>
        </Card>

        {tomorrowAssignments.length > 0 && (
          <Card title="Tomorrow" style={{ marginTop: spacing.lg }}>
            {tomorrowAssignments.map((a) => {
              const timeStr = a.isFullDay ? 'Full Day' : `${a.startTime}–${a.endTime}`;
              return (
                <View key={a.id} style={styles.scheduleRow}>
                  <Avatar firstName={a.person?.firstName ?? '?'} lastName={a.person?.lastName ?? '?'} size={28} uri={a.person?.avatarUrl} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                      {a.person?.firstName} {a.person?.lastName}
                    </Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{timeStr}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </View>
    );
  }

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    overview: renderOverview,
    people: renderPeople,
    schedule: renderSchedule,
    tasks: renderTasks,
    photos: renderPhotos,
    updates: renderUpdates,
    requests: renderRequests,
    activity: renderActivity,
    settings: renderSettings,
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Back to projects"
          >
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]} numberOfLines={1}>
              {p.name}
            </Text>
          </View>
          <Pressable style={styles.headerAction} accessibilityLabel="More options">
            <Feather name="more-horizontal" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <SectionTabs tabs={SECTIONS} activeTab={activeSection} onTabChange={setActiveSection} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sectionRenderers[activeSection]?.()}
      </ScrollView>

      {/* Photo Review Modal */}
      <Modal visible={!!reviewPhoto} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[typeScale.headingMedium, { color: colors.textPrimary }]}>Review Photo</Text>
              <Pressable onPress={() => setReviewPhoto(null)} style={styles.modalClose}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            {reviewPhoto && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <OptimizedImage
                  source={reviewPhoto.fileUrl}
                  style={[styles.reviewImage, { backgroundColor: colors.backgroundTertiary }]}
                  placeholder={reviewPhoto.blurhash}
                />

                <View style={styles.reviewMeta}>
                  <View style={styles.reviewMetaRow}>
                    <Feather name="user" size={14} color={colors.textTertiary} />
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                      {reviewPhoto.uploader ? `${reviewPhoto.uploader.firstName} ${reviewPhoto.uploader.lastName}` : 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.reviewMetaRow}>
                    <Feather name="clock" size={14} color={colors.textTertiary} />
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                      {formatDateTime(reviewPhoto.takenAt)}
                    </Text>
                  </View>
                  {reviewPhoto.taskTitle && (
                    <View style={styles.reviewMetaRow}>
                      <Feather name="check-square" size={14} color={colors.textTertiary} />
                      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                        {reviewPhoto.taskTitle}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.reviewField, { borderColor: colors.borderLight }]}>
                  <Text style={[typeScale.labelSmall, { color: colors.textTertiary }]}>Worker Caption (internal)</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                    {reviewPhoto.caption ?? 'No caption'}
                  </Text>
                </View>

                <View style={[styles.reviewField, { borderColor: colors.borderLight }]}>
                  <Text style={[typeScale.labelSmall, { color: colors.textTertiary }]}>Customer Description</Text>
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    What the customer sees when this photo is shared
                  </Text>
                  <TextInput
                    style={[styles.descInput, {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                      color: colors.textPrimary,
                    }]}
                    value={customerDesc}
                    onChangeText={setCustomerDesc}
                    placeholder="Add a description for the customer..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.reviewStatus}>
                  {reviewPhoto.isCustomerVisible ? (
                    <View style={[styles.sharedStatus, { backgroundColor: colors.primarySurface }]}>
                      <Feather name="eye" size={16} color={colors.primary} />
                      <Text style={[typeScale.bodySmall, { color: colors.primary, marginLeft: spacing.xs, fontWeight: '600' }]}>
                        Shared with customer
                      </Text>
                      {reviewPhoto.sharedAt && (
                        <Text style={[typeScale.caption, { color: colors.primary, marginLeft: 'auto' }]}>
                          {formatDateTime(reviewPhoto.sharedAt)}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={[styles.sharedStatus, { backgroundColor: colors.backgroundTertiary }]}>
                      <Feather name="eye-off" size={16} color={colors.textTertiary} />
                      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                        Internal only — not visible to customer
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.reviewActions}>
                  {reviewPhoto.isCustomerVisible ? (
                    <Button
                      title="Unshare from Customer"
                      onPress={handleUnsharePhoto}
                      variant="secondary"
                      icon="eye-off"
                      fullWidth
                    />
                  ) : (
                    <Button
                      title="Share with Customer"
                      onPress={handleSharePhoto}
                      variant="primary"
                      icon="eye"
                      fullWidth
                    />
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function DetailRow({ icon, label, value, colors }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; colors: any }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Feather name={icon} size={16} color={colors.textTertiary} />
      </View>
      <View style={styles.detailText}>
        <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{label}</Text>
        <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

function PersonRow({ person, role, colors }: { person: { firstName: string; lastName: string; email: string; phone?: string }; role: string; colors: any }) {
  return (
    <View style={styles.personRow}>
      <View style={[styles.avatar, { backgroundColor: colors.primarySurface }]}>
        <Text style={[typeScale.labelSmall, { color: colors.primary }]}>
          {person.firstName[0]}{person.lastName[0]}
        </Text>
      </View>
      <View style={styles.personInfo}>
        <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>
          {person.firstName} {person.lastName}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{role}</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, icon, colors }: { label: string; value: string; icon: keyof typeof Feather.glyphMap; colors: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <Feather name={icon} size={18} color={colors.primary} />
      <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function SettingRow({ label, value, colors }: { label: string; value: boolean; colors: any }) {
  return (
    <View style={styles.settingRow}>
      <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
      <View style={[styles.settingToggle, { backgroundColor: value ? '#43A047' : colors.textTertiary }]}>
        <View style={[styles.settingDot, value && styles.settingDotOn]} />
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
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
  headerTitle: {
    flex: 1,
  },
  headerAction: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingBottom: spacing['5xl'],
  },
  sectionContent: {
    padding: spacing.lg,
  },

  // Overview
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailIcon: {
    width: 24,
    alignItems: 'center',
    paddingTop: 2,
  },
  detailText: {
    flex: 1,
    gap: 2,
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
    borderWidth: 1,
    gap: spacing.xs,
  },

  // Schedule
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },

  // People
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: {
    flex: 1,
    gap: 2,
  },

  // Tasks
  taskStatsHeader: {
    marginBottom: spacing.lg,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  taskCheckbox: {
    width: 24,
    alignItems: 'center',
  },
  taskContent: {
    flex: 1,
    gap: 2,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
  },

  // Updates
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  visibleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },

  // Requests
  responseBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },

  // Activity
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
    gap: spacing.xs,
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  settingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  settingDotOn: {
    alignSelf: 'flex-end',
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
    marginTop: spacing.md,
  },

  // Photos
  photoStatsBar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  photoStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  photoGrid: {
    gap: spacing.sm,
  },
  photoCard: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photoThumb: {
    width: 80,
    height: 80,
  },
  photoCardInfo: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  photoCardBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  photoTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },

  // Photo review modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalClose: {
    padding: spacing.xs,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  reviewImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  reviewMeta: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewField: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  descInput: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  reviewStatus: {
    marginTop: spacing.lg,
  },
  sharedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  reviewActions: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },

  // Update composer
  composerInput: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  composerBody: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  visibilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
