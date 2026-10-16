import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { StatusBadge } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';
import { db } from '@/data/store';
import { TaskMediaStrip, TaskMediaViewer, type TaskMediaItem } from '@/components/tasks/TaskMedia';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentJob, projectTasks, projectSettings,
    startTask, completeTask, taskPhotoCaptured, taskPhotoUris, captureTaskPhoto, isTaskLead,
  } = useWorkerContext();

  const [busy, setBusy] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const tasks = currentJob ? projectTasks(currentJob.projectId) : [];
  const task = tasks.find(t => t.id === id);
  const attachments = task ? db.taskAttachments[task.id] ?? [] : [];
  const mediaItems: TaskMediaItem[] = attachments.map(a => ({ key: a.id, uri: a.fileUrl, mediaType: a.mediaType }));
  const settings = currentJob ? projectSettings(currentJob.projectId) : undefined;
  const photoRequired = settings?.completionPhotoRequired ?? false;
  const hasPhoto = task ? !!taskPhotoCaptured[task.id] : false;
  const photoUri = task ? taskPhotoUris[task.id] : undefined;
  const isLead = currentJob ? isTaskLead(currentJob.projectId) : false;
  const leadId = currentJob ? db.projects.find(p => p.id === currentJob.projectId)?.taskLeadId : undefined;
  const lead = leadId ? db.people[leadId] : undefined;

  if (!task) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Header onBack={() => router.back()} colors={colors} insets={insets} />
        <View style={styles.center}>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>Task not found</Text>
        </View>
      </View>
    );
  }

  const badge =
    task.status === 'completed'
      ? { label: 'Completed', status: 'success' as const }
      : task.status === 'in_progress'
      ? { label: 'In Progress', status: 'warning' as const }
      : { label: 'Not Started', status: 'neutral' as const };

  function handleStart() {
    haptics.select();
    startTask(task!.id);
  }

  function handleTakePhoto() {
    if (Platform.OS === 'web') {
      pickPhoto('library');
      return;
    }
    Alert.alert('Add Photo', undefined, [
      { text: 'Take Photo', onPress: () => pickPhoto('camera') },
      { text: 'Choose from Library', onPress: () => pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pickPhoto(source: 'camera' | 'library') {
    setBusy(true);
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          source === 'camera' ? 'Camera access needed' : 'Photo access needed',
          'Turn it on for Brighton Lawn in the Settings app to add task photos.',
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) {
        haptics.success();
        captureTaskPhoto(task!.id, result.assets[0].uri);
      }
    } catch {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            haptics.success();
            captureTaskPhoto(task!.id, URL.createObjectURL(file));
          }
        };
        input.click();
      }
    } finally {
      setBusy(false);
    }
  }

  function handleMarkComplete() {
    if (!completeTask(task!.id)) return;
    haptics.success();
    router.back();
  }

  const canComplete = !photoRequired || hasPhoto;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header onBack={() => router.back()} colors={colors} insets={insets} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>{task.title}</Text>
        <View style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}>
          <StatusBadge label={badge.label} status={badge.status} />
        </View>

        {task.status === 'completed' && (task.completer || task.completedAt) && (
          <View style={[styles.card, styles.notice, { backgroundColor: colors.successLight, marginTop: spacing.lg }]}>
            <Feather name="check-circle" size={18} color={colors.success} />
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>
              Completed{task.completer ? ` by ${task.completer.firstName} ${task.completer.lastName}`.trimEnd() : ''}
              {task.completedAt && (
                <Text style={{ color: colors.textSecondary }}>{'\n'}{formatCompletedAt(task.completedAt)}</Text>
              )}
            </Text>
          </View>
        )}

        {!isLead && task.status !== 'completed' && (
          <View style={[styles.card, styles.notice, { backgroundColor: colors.backgroundTertiary, marginTop: spacing.lg }]}>
            <Feather name="lock" size={18} color={colors.textSecondary} />
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>
              Only the Task Lead can check off tasks{'\n'}
              <Text style={{ color: colors.textSecondary }}>
                {lead
                  ? `${lead.firstName} ${lead.lastName}`.trim() + ' is the Task Lead for this job.'
                  : 'No Task Lead yet. The owner needs to pick one before tasks can be checked off.'}
              </Text>
            </Text>
          </View>
        )}

        {isLead && photoRequired && task.status !== 'completed' && (
          <View style={[styles.card, styles.notice, { backgroundColor: colors.infoLight, marginTop: spacing.lg }]}>
            <Feather name="camera" size={18} color={colors.info} />
            <Text style={[typeScale.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>
              Photos Required{'\n'}
              <Text style={{ color: colors.textSecondary }}>Take a photo when this task is complete.</Text>
            </Text>
          </View>
        )}

        {task.description && (
          <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.lg }, shadow.md]}>
            <Text style={[typeScale.caption, { color: colors.textSecondary, fontWeight: '600' }]}>NOTES</Text>
            <Text style={[typeScale.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>
              {task.description}
            </Text>
          </View>
        )}

        {attachments.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.lg }, shadow.md]}>
            <Text style={[typeScale.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
              {attachments.some(a => a.mediaType === 'video') ? 'PHOTOS AND VIDEOS' : 'PHOTOS'}
            </Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              Tap to see what needs to be done.
            </Text>
            <TaskMediaStrip items={mediaItems} onOpen={setViewerIndex} />
          </View>
        )}

        {((isLead && photoRequired) || photoUri) && (
          <View style={[styles.photoArea, { backgroundColor: colors.groupedBackground, marginTop: spacing.lg }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Feather name="image" size={32} color={colors.textTertiary} />
                <Text style={[typeScale.bodySmall, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                  No photo yet
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          {isLead && task.status === 'pending' && (
            <Pressable onPress={handleStart}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pillButton}
              >
                <Feather name="play" size={18} color="#FFFFFF" />
                <Text style={[typeScale.labelLarge, { color: '#FFFFFF', marginLeft: spacing.sm }]}>Start Task</Text>
              </LinearGradient>
            </Pressable>
          )}

          {isLead && task.status === 'in_progress' && (
            <>
              {photoRequired && (
                <Pressable
                  onPress={handleTakePhoto}
                  disabled={busy}
                  style={[styles.outlineButton, { borderColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
                >
                  <Feather name="camera" size={18} color={colors.primary} />
                  <Text style={[typeScale.labelLarge, { color: colors.primary, marginLeft: spacing.sm }]}>
                    {hasPhoto ? 'Retake Photo' : 'Take Photo'}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={handleMarkComplete} disabled={!canComplete}>
                <LinearGradient
                  colors={canComplete ? [colors.primary, colors.primaryDark] : [colors.border, colors.border]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pillButton}
                >
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <Text style={[typeScale.labelLarge, { color: '#FFFFFF', marginLeft: spacing.sm }]}>
                    Mark Complete
                  </Text>
                </LinearGradient>
              </Pressable>
              {photoRequired && !hasPhoto && (
                <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
                  Take a photo before marking this task complete.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <TaskMediaViewer
        items={mediaItems}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

function formatCompletedAt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function Header({ onBack, colors, insets }: { onBack: () => void; colors: any; insets: any }) {
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Feather name="arrow-left" size={22} color={colors.textPrimary} />
      </Pressable>
      <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
        Task Details
      </Text>
      <View style={{ width: 22 + spacing.xs * 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: { padding: spacing.xs },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] },
  card: { borderRadius: radius.xl, padding: spacing.lg },
  notice: { flexDirection: 'row', alignItems: 'flex-start' },
  photoArea: {
    height: 200,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center' },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radius.full,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
});
