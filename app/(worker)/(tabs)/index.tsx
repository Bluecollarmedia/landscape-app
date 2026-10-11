import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal, Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Avatar } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { JobMap } from '@/components/maps/JobMap';
import { semantic } from '@/theme/colors';
import { haptics } from '@/lib/haptics';
import type { Assignment } from '@/types/schedule';
import type { ProjectTask } from '@/types/project';
import type { Announcement } from '@/types/announcement';
import type { WeatherActionType } from '@/types/operations';
import { getProjectImageUriById, getWorkerHeaderImageUri } from '@/lib/projectImages';
import { BrandCover } from '@/components/branding/BrandCover';
import { WORKER_HERO_HEIGHT as HERO_HEIGHT } from '@/components/media/HeaderPhotoField';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';


const HERO_HEIGHT_COMPACT = 190;
const PILL_OVERHANG = 26;

function formatElapsed(startIso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(startIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatTime(time?: string) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

const WEATHER_ACTION_META: Record<WeatherActionType, { label: string; icon: string }> = {
  weather_warning: { label: 'Weather Warning', icon: 'cloud' },
  delayed_start: { label: 'Delayed Start', icon: 'clock' },
  no_work: { label: 'No Work Today', icon: 'x-circle' },
  early_finish: { label: 'Early Finish', icon: 'sunset' },
  project_cancel: { label: 'Project Cancelled', icon: 'x-circle' },
};

function minutesUntil(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

export default function WorkerTodayScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const {
    todayAssignments, currentJob, jobState, checkIns, checkOuts, moveToNextJob,
    scheduleConfirmed, confirmSchedule, checkIn, checkOut, locateForCheckIn, locateForCheckOut, openMapsNavigation,
    projectTasks, projectSettings, taskPhotoCaptured,
  } = useWorkerContext();

  // The job on screen: the one in progress, else the next unfinished one, else the last one
  // (so a worker who checked out by mistake can check back in).
  const primaryAssignment = currentJob
    ?? todayAssignments.find(a => a.status !== 'completed')
    ?? todayAssignments[todayAssignments.length - 1];
  const isCheckedIn = jobState === 'checked_in' || jobState === 'working';
  const showWorking = isCheckedIn && !!primaryAssignment;
  const showConfirmed = scheduleConfirmed && !!primaryAssignment && !isCheckedIn;
  const showCheckedOut = jobState === 'completed' && !!primaryAssignment;

  const { getUnreadForWorker, markAnnouncementRead } = useAnnouncements();
  const unreadAnnouncement: Announcement | null = user ? getUnreadForWorker(user.id) : null;
  const [openAnnouncement, setOpenAnnouncement] = useState(false);

  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const tagline = showConfirmed ? "You're all set for today." : "Let's get it done today.";

  const lastCheckIn = primaryAssignment
    ? [...checkIns].reverse().find(c => c.assignmentId === primaryAssignment.id)
    : undefined;
  const lastCheckOut = primaryAssignment
    ? [...checkOuts].reverse().find(c => c.assignmentId === primaryAssignment.id)
    : undefined;

  const tasks = primaryAssignment ? projectTasks(primaryAssignment.projectId) : [];
  const completedTasks = tasks.filter(t => t.status === 'completed');
  // Completed tasks fold away under a toggle so the list shows only what's left to do.
  const openTasks = tasks.filter(t => t.status !== 'completed');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const settings = primaryAssignment ? projectSettings(primaryAssignment.projectId) : undefined;
  const photoRequired = settings?.completionPhotoRequired ?? false;

  function handleConfirm() {
    haptics.success();
    confirmSchedule();
  }

  const [locating, setLocating] = useState(false);

  async function handleCheckIn() {
    if (locating) return;
    haptics.select();
    setLocating(true);
    const result = await locateForCheckIn(primaryAssignment?.id);
    setLocating(false);
    if (!result.ok) {
      haptics.warning();
      if (Platform.OS === 'web') {
        alert(`${result.title}\n\n${result.message}`);
      } else {
        Alert.alert(result.title, result.message, result.openSettings
          ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
          : [{ text: 'OK' }]);
      }
      return;
    }
    haptics.success();
    checkIn(result.gps, primaryAssignment?.id);
  }

  function handleCheckOutPress() {
    haptics.select();
    setShowCheckoutConfirm(true);
  }

  async function confirmCheckOut() {
    setShowCheckoutConfirm(false);
    haptics.success();
    // Location is recorded for the owner's records; it never blocks checking out.
    checkOut(await locateForCheckOut());
  }

  function handleBackToToday() {
    haptics.select();
    moveToNextJob();
  }

  function handleTaskPress(task: ProjectTask) {
    router.push(`/(worker)/task/${task.id}` as any);
  }

  function renderTaskRow(task: ProjectTask, first: boolean) {
    return (
      <Pressable
        key={task.id}
        style={[
          styles.taskRow,
          { borderTopColor: colors.borderLight, marginTop: first ? spacing.md : 0 },
        ]}
        onPress={() => handleTaskPress(task)}
      >
        {task.status === 'completed' ? (
          <Feather name="check-circle" size={22} color={colors.success} />
        ) : (
          <Feather name="circle" size={22} color={colors.border} />
        )}
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text
            style={[
              typeScale.bodyLarge,
              { color: task.status === 'completed' ? colors.textSecondary : colors.textPrimary },
              task.status === 'completed' && { textDecorationLine: 'line-through' },
            ]}
          >
            {task.title}
          </Text>
          {task.status === 'in_progress' && (
            <View style={[styles.inProgressTag, { backgroundColor: colors.warningLight }]}>
              <Text style={[typeScale.caption, { color: colors.warning }]}>In Progress</Text>
            </View>
          )}
        </View>
        {photoRequired && task.status !== 'completed' && !taskPhotoCaptured[task.id] && (
          <Feather name="camera" size={17} color={colors.info} style={{ marginRight: spacing.sm }} />
        )}
        <Feather name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>
    );
  }

  function handleOpenAnnouncement() {
    haptics.select();
    setOpenAnnouncement(true);
  }

  function handleCloseAnnouncement() {
    setOpenAnnouncement(false);
    if (user && unreadAnnouncement) {
      markAnnouncementRead(unreadAnnouncement.id, user.id);
    }
  }

  if (showCheckedOut && primaryAssignment) {
    const workedLabel = lastCheckIn && lastCheckOut
      ? formatElapsed(lastCheckIn.timestamp, new Date(lastCheckOut.timestamp))
      : lastCheckIn ? formatElapsed(lastCheckIn.timestamp, tick) : '—';

    return (
      <View style={[styles.screen, styles.checkedOutScreen, { backgroundColor: colors.background, paddingTop: insets.top + spacing['3xl'] }]}>
        <View style={[styles.checkedOutIcon, { backgroundColor: colors.success }]}>
          <Feather name="check" size={40} color="#FFFFFF" />
        </View>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.xl }]}>
          Checked Out
        </Text>
        <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          Great work today!
        </Text>

        <View style={[styles.card, styles.summaryCard, { backgroundColor: colors.surface }, shadow.md]}>
          <View style={styles.labelRow}>
            <View style={[styles.jobIcon, { backgroundColor: colors.primarySurface }]}>
              <Feather name="home" size={14} color={colors.primaryDark} />
            </View>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
              {primaryAssignment.project?.name ?? 'Unknown Project'}
            </Text>
          </View>
          {primaryAssignment.project?.address && (
            <View style={[styles.metaRow, { marginLeft: 36 }]}>
              <Feather name="map-pin" size={13} color={colors.textTertiary} />
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                {primaryAssignment.project.address}
              </Text>
            </View>
          )}

          <View style={[styles.summaryDivider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.summaryRow}>
            <View style={styles.labelRow}>
              <Feather name="clock" size={14} color={colors.textTertiary} />
              <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginLeft: spacing.xs }]}>Worked</Text>
            </View>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>{workedLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.labelRow}>
              <Feather name="check-square" size={14} color={colors.textTertiary} />
              <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginLeft: spacing.xs }]}>Tasks Completed</Text>
            </View>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
              {completedTasks.length} of {tasks.length}
            </Text>
          </View>
        </View>

        <Pressable onPress={handleBackToToday} style={{ width: '100%' }}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pillButton}
          >
            <Feather name="home" size={18} color="#FFFFFF" />
            <Text style={[typeScale.labelLarge, { color: '#FFFFFF', marginLeft: spacing.sm }]}>
              Back to Today
            </Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={handleCheckIn} hitSlop={8} style={{ marginTop: spacing.lg }} accessibilityRole="button">
          <Text style={[typeScale.labelLarge, { color: colors.primary }]}>{locating ? 'Finding your location…' : 'Left by mistake? Check back in'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarClearance }}>
        <View style={[styles.hero, { height: showWorking ? HERO_HEIGHT_COMPACT : HERO_HEIGHT }]}>
          <BrandCover uri={(primaryAssignment && getProjectImageUriById(primaryAssignment.projectId)) || getWorkerHeaderImageUri()} style={styles.heroImage} />
          <LinearGradient
            colors={['transparent', 'transparent', colors.groupedBackground]}
            locations={[0, 0.78, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={[styles.avatarWrap, { top: insets.top + spacing.sm }]}>
            <Avatar firstName={user?.firstName ?? ''} lastName={user?.lastName ?? ''} size={44} uri={user?.avatarUrl} />
          </View>

          {showWorking ? (
            <View style={[styles.onSitePill, { top: insets.top + spacing.sm, backgroundColor: 'rgba(255,255,255,0.9)' }]}>
              <View style={[styles.onSiteDot, { backgroundColor: colors.success }]} />
              <Text style={[typeScale.labelSmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}>On Site</Text>
            </View>
          ) : (
            <View style={styles.heroText}>
              <Text style={[typeScale.bodyMedium, styles.heroTextShadow, { color: '#FFFFFF' }]}>{dateStr}</Text>
              <Text style={[typeScale.displayLarge, styles.heroTextShadow, { color: '#FFFFFF', marginTop: 2 }]}>
                {greeting},{'\n'}{user?.firstName ?? 'there'}
              </Text>
              <Text style={[typeScale.bodyLarge, styles.heroTextShadow, { color: '#FFFFFF', marginTop: spacing.xs }]}>
                {tagline}
              </Text>
            </View>
          )}

          {!showWorking && primaryAssignment?.truck && (
            <Pressable style={[styles.truckPill, { backgroundColor: colors.primarySurface, bottom: -PILL_OVERHANG }, shadow.md]}>
              <Feather name="truck" size={18} color={colors.primaryDark} />
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm, fontWeight: '600' }]}>
                {primaryAssignment.truck.name}
              </Text>
              <Feather name="chevron-right" size={18} color={colors.primaryDark} />
            </Pressable>
          )}
        </View>

        <View style={[styles.content, { paddingTop: showWorking ? spacing.xl : PILL_OVERHANG + spacing.xl }]}>
          {unreadAnnouncement && (() => {
            const weatherMeta = unreadAnnouncement.weatherAction ? WEATHER_ACTION_META[unreadAnnouncement.weatherAction] : null;
            const isStrong = unreadAnnouncement.priority === 'urgent' || !!weatherMeta;
            return (
              <Pressable
                onPress={handleOpenAnnouncement}
                style={[
                  styles.card,
                  styles.announcementCard,
                  isStrong
                    ? { backgroundColor: colors.errorLight, borderWidth: 1, borderColor: colors.error }
                    : { backgroundColor: colors.surface },
                  shadow.md,
                ]}
              >
                <View style={[styles.announcementIcon, { backgroundColor: isStrong ? colors.error : colors.primarySurface }]}>
                  <Feather name={(weatherMeta?.icon ?? 'volume-2') as any} size={16} color={isStrong ? '#FFFFFF' : colors.primaryDark} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <View style={styles.announcementTopRow}>
                    <Text style={[typeScale.labelSmall, { color: isStrong ? colors.error : colors.textSecondary, fontWeight: '700' }]}>
                      {weatherMeta ? weatherMeta.label.toUpperCase() : unreadAnnouncement.priority === 'urgent' ? 'URGENT' : 'ANNOUNCEMENT'}
                    </Text>
                  </View>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]} numberOfLines={1}>
                    {unreadAnnouncement.title}
                  </Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>
                    {unreadAnnouncement.body}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={isStrong ? colors.error : colors.textTertiary} />
              </Pressable>
            );
          })()}

          {!scheduleConfirmed && todayAssignments.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface }, shadow.md]}>
              <Feather name="check-square" size={26} color={colors.primary} />
              <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginTop: spacing.md }]}>
                Confirm Your Schedule
              </Text>
              <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                You have {todayAssignments.length} job{todayAssignments.length > 1 ? 's' : ''} today.
                Confirm to let the team know you're ready.
              </Text>
              <Pressable onPress={handleConfirm} style={{ marginTop: spacing.lg }}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pillButton}
                >
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <Text style={[typeScale.labelLarge, { color: '#FFFFFF', marginLeft: spacing.sm }]}>
                    Confirm Schedule
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {!scheduleConfirmed && primaryAssignment && (
            <JobCard label="Today's Job" assignment={primaryAssignment} />
          )}

          {showConfirmed && primaryAssignment && (
            <>
              <View style={[styles.card, styles.mapCard, { backgroundColor: colors.surface }, shadow.md]}>
                <JobCardBody label="Next Job" assignment={primaryAssignment} />

                {primaryAssignment.project?.address && (
                  <>
                    <Pressable onPress={() => openMapsNavigation(primaryAssignment.project!)} accessibilityLabel="Open in Maps">
                      <JobMap place={primaryAssignment.project} />
                    </Pressable>
                    <Pressable
                      style={styles.openMapsRow}
                      onPress={() => openMapsNavigation(primaryAssignment.project!)}
                    >
                      <Feather name="navigation" size={15} color={colors.primary} />
                      <Text style={[typeScale.bodyMedium, { color: colors.primary, flex: 1, marginLeft: spacing.sm, fontWeight: '600' }]}>
                        Open in Maps
                      </Text>
                      <Feather name="chevron-right" size={16} color={colors.textTertiary} />
                    </Pressable>
                  </>
                )}
              </View>

              {primaryAssignment.startTime && (
                <View style={styles.countdownRow}>
                  <Feather name="clock" size={14} color={colors.textSecondary} />
                  <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                    {(() => {
                      const mins = minutesUntil(primaryAssignment.startTime!);
                      if (mins > 1) return `Starts in ${mins} minutes`;
                      if (mins === 1) return 'Starts in 1 minute';
                      return 'Starting now';
                    })()}
                  </Text>
                </View>
              )}

              <Pressable onPress={handleCheckIn}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.pillButton, styles.checkInButton]}
                >
                  <View style={styles.checkInRow}>
                    <Feather name="log-in" size={20} color="#FFFFFF" />
                    <Text style={[typeScale.headingSmall, { color: '#FFFFFF', marginLeft: spacing.sm, fontWeight: '700' }]}>
                      I'M HERE
                    </Text>
                  </View>
                  <Text style={[typeScale.bodySmall, { color: 'rgba(255,255,255,0.85)', marginTop: 2 }]}>
                    {locating ? 'Finding your location…' : 'Check in to start this job'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </>
          )}

          {showWorking && primaryAssignment && (
            <>
              <View>
                <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
                  {primaryAssignment.project?.name ?? 'Unknown Project'}
                </Text>
                {primaryAssignment.project?.address && (
                  <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
                    <Feather name="map-pin" size={13} color={colors.textTertiary} />
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                      {primaryAssignment.project.address}
                    </Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Feather name="clock" size={13} color={colors.textTertiary} />
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                    {primaryAssignment.isFullDay ? 'Full day' : `${formatTime(primaryAssignment.startTime)} – ${formatTime(primaryAssignment.endTime)}`}
                  </Text>
                </View>
              </View>

              <View style={[styles.card, styles.statCard, { backgroundColor: colors.surface }, shadow.md]}>
                <View style={styles.statCol}>
                  <View style={styles.labelRow}>
                    <Feather name="check-circle" size={13} color={colors.success} />
                    <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs, fontWeight: '600' }]}>
                      Checked In
                    </Text>
                  </View>
                  <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                    {lastCheckIn ? formatClock(lastCheckIn.timestamp) : '—'}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
                <View style={styles.statCol}>
                  <View style={styles.labelRow}>
                    <Feather name="clock" size={13} color={colors.primary} />
                    <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs, fontWeight: '600' }]}>
                      On site for
                    </Text>
                  </View>
                  <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                    {lastCheckIn ? formatElapsed(lastCheckIn.timestamp, tick) : '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                {primaryAssignment.project?.address && (
                  <Pressable
                    style={[styles.actionPill, { backgroundColor: colors.primarySurface }]}
                    onPress={() => openMapsNavigation(primaryAssignment.project!)}
                  >
                    <Feather name="navigation" size={16} color={colors.primaryDark} />
                    <Text style={[typeScale.bodyMedium, { color: colors.primaryDark, marginLeft: spacing.xs, fontWeight: '600' }]}>
                      Open in Maps
                    </Text>
                  </Pressable>
                )}
              </View>

              {tasks.length > 0 && (
                <View style={[styles.card, styles.mapCard, { backgroundColor: colors.surface }, shadow.md]}>
                  <View style={styles.tasksHeader}>
                    <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>Today's Tasks</Text>
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                      {completedTasks.length} of {tasks.length} completed
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: spacing.lg }}>
                    <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { backgroundColor: colors.primary, width: `${tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0}%` },
                        ]}
                      />
                    </View>
                  </View>
                  {openTasks.map((task, i) => renderTaskRow(task, i === 0))}
                  {openTasks.length === 0 && (
                    <View style={[styles.allDoneRow, { marginTop: spacing.md }]}>
                      <Feather name="check-circle" size={18} color={colors.success} />
                      <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                        All tasks done
                      </Text>
                    </View>
                  )}
                  {completedTasks.length > 0 && (
                    <Pressable
                      style={[styles.completedToggle, { borderTopColor: colors.borderLight }]}
                      onPress={() => { haptics.select(); setShowCompletedTasks(v => !v); }}
                    >
                      <Text style={[typeScale.bodyLarge, { color: colors.primary, fontWeight: '600', flex: 1 }]}>
                        {showCompletedTasks ? 'Hide completed' : `Show completed (${completedTasks.length})`}
                      </Text>
                      <Feather name={showCompletedTasks ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
                    </Pressable>
                  )}
                  {showCompletedTasks && completedTasks.map(task => renderTaskRow(task, false))}
                </View>
              )}

              {primaryAssignment.notes && (
                <View style={[styles.card, { backgroundColor: colors.surface }, shadow.md]}>
                  <View style={styles.labelRow}>
                    <Feather name="file-text" size={15} color={colors.primary} />
                    <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs, fontWeight: '600' }]}>
                      Job Notes
                    </Text>
                  </View>
                  <Text style={[typeScale.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                    {primaryAssignment.notes}
                  </Text>
                </View>
              )}

              <Pressable onPress={handleCheckOutPress}>
                <LinearGradient
                  colors={['#E1615D', '#C4453F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, styles.leavingCard, { borderRadius: 28 }]}
                >
                  <Feather name="log-out" size={22} color="#FFFFFF" />
                  <View style={{ marginLeft: spacing.md }}>
                    <Text style={[typeScale.headingSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
                      I'M LEAVING
                    </Text>
                    <Text style={[typeScale.bodySmall, { color: 'rgba(255,255,255,0.85)' }]}>
                      Check out when you're done
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showCheckoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCheckoutConfirm(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowCheckoutConfirm(false)}
        >
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={[styles.modalIcon, { backgroundColor: colors.errorLight }]}>
              <Feather name="log-out" size={24} color={colors.error} />
            </View>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
              You're done for today?
            </Text>
            <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
              This checks you out from {primaryAssignment?.project?.name ?? 'this job'} and ends your work session.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowCheckoutConfirm(false)}
              >
                <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalButton} onPress={confirmCheckOut}>
                <LinearGradient
                  colors={['#E1615D', '#C4453F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonFill}
                >
                  <Text style={[typeScale.labelLarge, { color: '#FFFFFF' }]}>Check Out</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <BottomSheetModal visible={openAnnouncement} onRequestClose={handleCloseAnnouncement}>
        <Pressable style={styles.sheetBackdrop} onPress={handleCloseAnnouncement}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderLight }]} />
            {unreadAnnouncement && (() => {
              const weatherMeta = unreadAnnouncement.weatherAction ? WEATHER_ACTION_META[unreadAnnouncement.weatherAction] : null;
              const isStrong = unreadAnnouncement.priority === 'urgent' || !!weatherMeta;
              return (
                <>
                  {isStrong && (
                    <View style={[styles.sheetBadge, { backgroundColor: colors.errorLight }]}>
                      <Feather name={(weatherMeta?.icon ?? 'alert-circle') as any} size={13} color={colors.error} />
                      <Text style={[typeScale.labelSmall, { color: colors.error, fontWeight: '700', marginLeft: 4 }]}>
                        {weatherMeta ? weatherMeta.label.toUpperCase() : 'URGENT'}
                      </Text>
                    </View>
                  )}
                  <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginTop: spacing.sm }]}>
                    {unreadAnnouncement.title}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                    {unreadAnnouncement.author?.firstName} {unreadAnnouncement.author?.lastName}
                  </Text>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginTop: spacing.md, lineHeight: 22 }]}>
                    {unreadAnnouncement.body}
                  </Text>
                  <Pressable
                    style={[styles.pillButton, { backgroundColor: colors.primary, marginTop: spacing.xl }]}
                    onPress={handleCloseAnnouncement}
                  >
                    <Text style={[typeScale.labelLarge, { color: '#FFFFFF', fontWeight: '700' }]}>Got it</Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </BottomSheetModal>
    </View>
  );
}

function JobCard({ label, assignment }: { label: string; assignment: Assignment }) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.card, styles.mapCard, { backgroundColor: colors.surface }, shadow.md]}>
      <JobCardBody label={label} assignment={assignment} />
    </Pressable>
  );
}

function JobCardBody({ label, assignment }: { label: string; assignment: Assignment }) {
  const { colors } = useTheme();
  return (
    <View style={styles.jobCard}>
      <View style={{ flex: 1 }}>
        <View style={styles.labelRow}>
          <Feather name="calendar" size={13} color={colors.primary} />
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs, fontWeight: '600' }]}>
            {label}
          </Text>
        </View>

        <View style={[styles.labelRow, { marginTop: spacing.sm }]}>
          <View style={[styles.jobIcon, { backgroundColor: colors.primarySurface }]}>
            <Feather name="home" size={14} color={colors.primaryDark} />
          </View>
          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
            {assignment.project?.name ?? 'Unknown Project'}
          </Text>
        </View>

        {assignment.project?.address && (
          <View style={[styles.metaRow, { marginLeft: 36 }]}>
            <Feather name="map-pin" size={13} color={colors.textTertiary} />
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
              {assignment.project.address}
            </Text>
          </View>
        )}
        <View style={[styles.metaRow, { marginLeft: 36 }]}>
          <Feather name="clock" size={13} color={colors.textTertiary} />
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
            {assignment.isFullDay ? 'Full day' : `${formatTime(assignment.startTime)} – ${formatTime(assignment.endTime)}`}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textTertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: HERO_HEIGHT, width: '100%' },
  heroImage: { width: '100%', height: '100%' },
  avatarWrap: { position: 'absolute', right: spacing.lg },
  heroText: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 100 },
  heroTextShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  truckPill: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  card: { borderRadius: radius.xl, padding: spacing.lg },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radius.full,
  },
  jobCard: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.lg },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  jobIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  mapCard: { padding: 0, overflow: 'hidden' },
  openMapsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInButton: { height: 72, flexDirection: 'column' },
  checkInRow: { flexDirection: 'row', alignItems: 'center' },
  onSitePill: {
    position: 'absolute',
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  onSiteDot: { width: 7, height: 7, borderRadius: 4 },
  statCard: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1 },
  statDivider: { width: 1, height: 40, marginHorizontal: spacing.lg },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  progressTrack: {
    height: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: 5, borderRadius: radius.full },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inProgressTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginTop: 4,
  },
  leavingCard: { flexDirection: 'row', alignItems: 'center' },
  allDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkedOutScreen: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  checkedOutIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: { width: '100%' },
  summaryDivider: { height: 1, marginVertical: spacing.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  announcementIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  sheetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
