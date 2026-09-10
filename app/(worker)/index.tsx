import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { Card, Button, StatusBadge, EmptyState } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { Assignment } from '@/types/schedule';
import type { ProjectTask } from '@/types/project';
import { useWorkerReminders } from '@/hooks/useOperations';

function formatTime(time?: string) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function ScheduleConfirmation() {
  const { colors } = useTheme();
  const {
    todayAssignments, scheduleConfirmed, hasScheduleChanges,
    confirmSchedule, acknowledgeChanges,
  } = useWorkerContext();

  if (todayAssignments.length === 0) return null;

  if (hasScheduleChanges) {
    return (
      <Card style={[styles.confirmCard, { borderColor: colors.warning, borderWidth: 2 }]}>
        <View style={styles.confirmHeader}>
          <Feather name="alert-triangle" size={20} color={colors.warning} />
          <Text style={[typeScale.headingSmall, { color: colors.warning, marginLeft: spacing.sm }]}>
            Schedule Updated
          </Text>
        </View>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          Your schedule has changed since you last confirmed. Review and acknowledge.
        </Text>
        <Button
          title="I've Seen the Changes"
          onPress={acknowledgeChanges}
          variant="secondary"
          fullWidth
          icon="check"
          style={{ marginTop: spacing.md }}
        />
      </Card>
    );
  }

  if (!scheduleConfirmed) {
    return (
      <Card style={[styles.confirmCard, { borderColor: colors.primary, borderWidth: 2 }]}>
        <View style={styles.confirmHeader}>
          <Feather name="check-circle" size={20} color={colors.primary} />
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
            Confirm Your Schedule
          </Text>
        </View>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          You have {todayAssignments.length} job{todayAssignments.length > 1 ? 's' : ''} today. Confirm to let the team know you're ready.
        </Text>
        <Button
          title="Confirm Schedule"
          onPress={confirmSchedule}
          fullWidth
          icon="check"
          style={{ marginTop: spacing.md }}
        />
      </Card>
    );
  }

  return null;
}

function TruckBanner() {
  const { colors } = useTheme();
  const { todayAssignments } = useWorkerContext();
  const truck = todayAssignments.find(a => a.truck)?.truck;

  if (!truck) return null;

  return (
    <View style={[styles.truckBanner, { backgroundColor: colors.primaryLight }]}>
      <Feather name="truck" size={18} color={colors.primary} />
      <Text style={[typeScale.bodyMedium, { color: colors.primary, fontWeight: '600', marginLeft: spacing.sm }]}>
        {truck.name}
      </Text>
    </View>
  );
}

function JobCard({ assignment, isCurrent, isNext }: { assignment: Assignment; isCurrent: boolean; isNext: boolean }) {
  const { colors } = useTheme();
  const { jobState, openMapsNavigation } = useWorkerContext();

  const borderColor = isCurrent ? colors.primary : isNext ? colors.warning : colors.borderLight;
  const borderWidth = isCurrent || isNext ? 2 : 1;

  return (
    <Card style={[styles.jobCard, { borderColor, borderWidth }]}>
      <View style={styles.jobHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
            {assignment.project?.name ?? 'Unknown Project'}
          </Text>
          {assignment.project?.address && (
            <Pressable onPress={() => openMapsNavigation(assignment.project!.address!)}>
              <Text style={[typeScale.bodySmall, { color: colors.primary, marginTop: 2 }]}>
                <Feather name="map-pin" size={12} /> {assignment.project.address}
              </Text>
            </Pressable>
          )}
        </View>
        {isCurrent && (
          <StatusBadge label={jobState === 'working' ? 'Working' : 'Checked In'} status="success" />
        )}
        {isNext && !isCurrent && (
          <StatusBadge label="Up Next" status="warning" />
        )}
      </View>

      <View style={styles.jobTime}>
        <Feather name="clock" size={14} color={colors.textTertiary} />
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
          {assignment.isFullDay
            ? 'Full day'
            : `${formatTime(assignment.startTime)} – ${formatTime(assignment.endTime)}`}
        </Text>
      </View>

      {assignment.notes && (
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
          {assignment.notes}
        </Text>
      )}

      {assignment.project?.address && !isCurrent && (
        <Button
          title="Navigate"
          onPress={() => openMapsNavigation(assignment.project!.address!)}
          variant="secondary"
          icon="navigation"
          style={{ marginTop: spacing.md }}
        />
      )}
    </Card>
  );
}

function WorkerRemindersSection() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { reminders } = useWorkerReminders(user?.id);

  if (reminders.length === 0) return null;

  return (
    <>
      {reminders.map((r) => (
        <View
          key={r.id}
          style={[
            styles.reminderCard,
            {
              backgroundColor: r.reminderType === 'past_scheduled_end' ? '#FFF8E1' : '#E3F2FD',
              borderColor: r.reminderType === 'past_scheduled_end' ? '#F9A825' : '#1976D2',
            },
          ]}
        >
          <Feather
            name={r.reminderType === 'past_scheduled_end' ? 'clock' : r.reminderType === 'schedule_changed' ? 'calendar' : 'bell'}
            size={18}
            color={r.reminderType === 'past_scheduled_end' ? '#F9A825' : '#1976D2'}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>
              {r.title}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{r.body}</Text>
            {r.nextAssignment && (
              <Text style={[typeScale.caption, { color: colors.primary, marginTop: spacing['2xs'] }]}>
                Next: {r.nextAssignment.projectName} at {r.nextAssignment.startTime}
              </Text>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

function CheckInButton() {
  const { colors } = useTheme();
  const { jobState, checkIn, todayAssignments, currentJob, scheduleConfirmed } = useWorkerContext();

  if (jobState === 'checked_in' || jobState === 'working' || jobState === 'completed') return null;
  if (todayAssignments.length === 0) return null;

  const targetJob = currentJob ?? todayAssignments.find(a => a.status !== 'completed');
  if (!targetJob) return null;

  const handleCheckIn = () => {
    const mockGps = {
      latitude: 41.4756 + (Math.random() - 0.5) * 0.001,
      longitude: -81.5558 + (Math.random() - 0.5) * 0.001,
      accuracy: 8 + Math.random() * 20,
      distanceFromSite: Math.floor(Math.random() * 100),
    };
    checkIn(mockGps);
  };

  return (
    <Pressable
      onPress={handleCheckIn}
      style={[styles.bigActionButton, { backgroundColor: colors.primary }]}
    >
      <Feather name="log-in" size={28} color="#fff" />
      <Text style={[typeScale.headingMedium, { color: '#fff', marginTop: spacing.xs }]}>
        I'M HERE
      </Text>
      <Text style={[typeScale.caption, { color: 'rgba(255,255,255,0.8)' }]}>
        {targetJob.project?.name}
      </Text>
    </Pressable>
  );
}

function TaskList() {
  const { colors } = useTheme();
  const {
    currentJob, projectTasks, startTask, completeTask,
    projectSettings, taskPhotoCaptured, captureTaskPhoto,
  } = useWorkerContext();

  if (!currentJob) return null;

  const tasks = projectTasks(currentJob.projectId);
  const settings = projectSettings(currentJob.projectId);
  const photoRequired = settings?.completionPhotoRequired ?? false;

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (tasks.length === 0) return null;

  const handleComplete = (task: ProjectTask) => {
    if (photoRequired && !taskPhotoCaptured[task.id]) {
      const doCapture = () => {
        captureTaskPhoto(task.id);
        completeTask(task.id);
      };
      if (Platform.OS === 'web') {
        doCapture();
      } else {
        Alert.alert(
          'Photo Required',
          'A completion photo is required before marking this task complete.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take Photo', onPress: doCapture },
          ],
        );
      }
      return;
    }
    completeTask(task.id);
  };

  return (
    <Card title="Tasks" style={styles.taskSection}>
      {photoRequired && (
        <View style={[styles.photoNotice, { backgroundColor: colors.infoLight }]}>
          <Feather name="camera" size={14} color={colors.info} />
          <Text style={[typeScale.caption, { color: colors.info, marginLeft: spacing.xs }]}>
            Completion photos required for this project
          </Text>
        </View>
      )}

      {activeTasks.map(task => (
        <View key={task.id} style={[styles.taskRow, { borderBottomColor: colors.borderLight }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyMedium, { color: colors.textPrimary }]}>{task.title}</Text>
            {task.status === 'in_progress' && (
              <StatusBadge label="In Progress" status="warning" />
            )}
          </View>
          <View style={styles.taskActions}>
            {task.status === 'pending' && (
              <Pressable
                onPress={() => startTask(task.id)}
                style={[styles.taskBtn, { backgroundColor: colors.primaryLight }]}
              >
                <Feather name="play" size={16} color={colors.primary} />
              </Pressable>
            )}
            {task.status === 'in_progress' && (
              <>
                {photoRequired && !taskPhotoCaptured[task.id] && (
                  <Pressable
                    onPress={() => captureTaskPhoto(task.id)}
                    style={[styles.taskBtn, { backgroundColor: colors.warningLight, marginRight: spacing.xs }]}
                  >
                    <Feather name="camera" size={16} color={colors.warning} />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => handleComplete(task)}
                  style={[styles.taskBtn, { backgroundColor: colors.successLight }]}
                >
                  <Feather name="check" size={16} color={colors.success} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      ))}

      {completedTasks.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typeScale.caption, { color: colors.textTertiary, marginBottom: spacing.xs }]}>
            Completed ({completedTasks.length})
          </Text>
          {completedTasks.slice(0, 3).map(task => (
            <View key={task.id} style={[styles.taskRow, { borderBottomColor: colors.borderLight, opacity: 0.6 }]}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm, textDecorationLine: 'line-through' }]}>
                {task.title}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function CheckOutButton() {
  const { colors } = useTheme();
  const { jobState, checkOut, currentJob, nextJob, moveToNextJob } = useWorkerContext();

  if (jobState !== 'checked_in' && jobState !== 'working') return null;

  const handleCheckOut = () => {
    const mockGps = {
      latitude: 41.4756 + (Math.random() - 0.5) * 0.001,
      longitude: -81.5558 + (Math.random() - 0.5) * 0.001,
      accuracy: 8 + Math.random() * 20,
      distanceFromSite: Math.floor(Math.random() * 100),
    };
    checkOut(mockGps);
  };

  return (
    <View style={styles.checkOutSection}>
      <Pressable
        onPress={handleCheckOut}
        style={[styles.bigActionButton, { backgroundColor: colors.error }]}
      >
        <Feather name="log-out" size={28} color="#fff" />
        <Text style={[typeScale.headingMedium, { color: '#fff', marginTop: spacing.xs }]}>
          I'M LEAVING
        </Text>
        <Text style={[typeScale.caption, { color: 'rgba(255,255,255,0.8)' }]}>
          {currentJob?.project?.name}
        </Text>
      </Pressable>
    </View>
  );
}

function NextJobPrompt() {
  const { colors } = useTheme();
  const { jobState, nextJob, moveToNextJob, openMapsNavigation } = useWorkerContext();

  if (jobState !== 'completed' || !nextJob) return null;

  return (
    <Card style={[styles.nextJobCard, { borderColor: colors.primary, borderWidth: 2 }]}>
      <View style={styles.confirmHeader}>
        <Feather name="arrow-right-circle" size={20} color={colors.primary} />
        <Text style={[typeScale.headingSmall, { color: colors.primary, marginLeft: spacing.sm }]}>
          Next Job
        </Text>
      </View>
      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginTop: spacing.sm }]}>
        {nextJob.project?.name}
      </Text>
      <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
        {nextJob.isFullDay ? 'Full day' : `${formatTime(nextJob.startTime)} – ${formatTime(nextJob.endTime)}`}
      </Text>
      {nextJob.project?.address && (
        <Button
          title="Navigate to Next Job"
          onPress={() => openMapsNavigation(nextJob.project!.address!)}
          variant="secondary"
          icon="navigation"
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      )}
      <Button
        title="Start Next Job"
        onPress={moveToNextJob}
        fullWidth
        icon="arrow-right"
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );
}

function DayComplete() {
  const { colors } = useTheme();
  const { jobState, nextJob, todayAssignments, completedAssignments } = useWorkerContext();
  const todayCompleted = todayAssignments.filter(a => a.status === 'completed' || completedAssignments.some(c => c.id === a.id));

  if (jobState !== 'completed' || nextJob) return null;

  return (
    <View style={styles.dayComplete}>
      <Feather name="check-circle" size={48} color={colors.success} />
      <Text style={[typeScale.headingMedium, { color: colors.textPrimary, marginTop: spacing.md }]}>
        Day Complete!
      </Text>
      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
        Great work today. Drive safe!
      </Text>
    </View>
  );
}

function OfflineIndicator() {
  const { colors } = useTheme();
  const { isOnline, offlineQueue } = useWorkerContext();

  if (isOnline && offlineQueue.length === 0) return null;

  return (
    <View style={[styles.offlineBanner, { backgroundColor: isOnline ? colors.warningLight : colors.errorLight }]}>
      <Feather name={isOnline ? 'upload-cloud' : 'wifi-off'} size={16} color={isOnline ? colors.warning : colors.error} />
      <Text style={[typeScale.caption, { color: isOnline ? colors.warning : colors.error, marginLeft: spacing.xs }]}>
        {isOnline
          ? `Syncing ${offlineQueue.length} action${offlineQueue.length > 1 ? 's' : ''}...`
          : 'Offline — actions will sync when connection returns'}
      </Text>
    </View>
  );
}

export default function WorkerTodayScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { todayAssignments, currentJob, nextJob, jobState } = useWorkerContext();

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing['5xl'] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{dateStr}</Text>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
          {greeting}, {user?.firstName ?? 'there'}
        </Text>
      </View>

      <View style={styles.content}>
        <OfflineIndicator />
        <TruckBanner />
        <ScheduleConfirmation />
        <WorkerRemindersSection />

        {todayAssignments.length === 0 ? (
          <EmptyState
            icon="sun"
            title="No jobs today"
            description="Enjoy your day off! Check back for upcoming assignments."
          />
        ) : (
          <>
            <CheckInButton />

            {todayAssignments.map(a => (
              <JobCard
                key={a.id}
                assignment={a}
                isCurrent={currentJob?.id === a.id}
                isNext={nextJob?.id === a.id && currentJob?.id !== a.id}
              />
            ))}

            <TaskList />
            <CheckOutButton />
            <NextJobPrompt />
            <DayComplete />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  confirmCard: {
    marginBottom: spacing.lg,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  truckBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  jobCard: {
    marginBottom: spacing.md,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  bigActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  taskSection: {
    marginBottom: spacing.lg,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
    marginBottom: spacing.sm,
  },
  checkOutSection: {
    marginTop: spacing.sm,
  },
  nextJobCard: {
    marginBottom: spacing.lg,
  },
  dayComplete: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    marginBottom: spacing.sm,
  },
});
