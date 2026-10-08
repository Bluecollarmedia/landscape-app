import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useAuth } from './AuthProvider';
import { db, useDb, insertRow, updateRow, upsertRow, findRow } from '@/data/store';
import { addProjectPhoto, logProjectHistory, notifyStaff } from '@/data/actions';
import { todayKey, localDateTime } from '@/lib/ids';
import type { Assignment } from '@/types/schedule';
import type { ProjectTask, ProjectSettings } from '@/types/project';
import type {
  CheckIn,
  CheckOut,
  GPSCoordinates,
  WorkerActivity,
  WorkerSettings,
  NavAppPreference,
  OfflineAction,
  OfflineSyncStatus,
} from '@/types/worker';

type JobState = 'not_started' | 'confirmed' | 'en_route' | 'checked_in' | 'working' | 'completed';

interface WorkerContextValue {
  todayAssignments: Assignment[];
  upcomingAssignments: Assignment[];
  completedAssignments: Assignment[];
  currentJob: Assignment | null;
  nextJob: Assignment | null;
  jobState: JobState;
  scheduleConfirmed: boolean;
  hasScheduleChanges: boolean;

  confirmSchedule: () => void;
  acknowledgeChanges: () => void;

  checkIn: (gps: GPSCoordinates) => void;
  checkOut: (gps: GPSCoordinates) => void;
  isWithinRadius: (gps: GPSCoordinates, projectId: string) => boolean;
  checkIns: CheckIn[];
  checkOuts: CheckOut[];

  projectTasks: (projectId: string) => ProjectTask[];
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  projectSettings: (projectId: string) => ProjectSettings | undefined;
  taskPhotoCaptured: Record<string, boolean>;
  taskPhotoUris: Record<string, string>;
  captureTaskPhoto: (taskId: string, uri?: string) => void;

  activities: WorkerActivity[];
  settings: WorkerSettings;
  updateNavApp: (app: NavAppPreference) => void;
  updateNotificationsEnabled: (enabled: boolean) => void;

  offlineQueue: OfflineAction[];
  isOnline: boolean;

  openMapsNavigation: (address: string) => void;
  moveToNextJob: () => void;
}

const WorkerContext = createContext<WorkerContextValue | null>(null);

export function useWorkerContext() {
  const ctx = useContext(WorkerContext);
  if (!ctx) throw new Error('useWorkerContext must be used within WorkerProvider');
  return ctx;
}

export function WorkerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const workerId = user?.id ?? '';
  const v = useDb();

  const today = todayKey();

  const allAssignments = useMemo(() =>
    db.assignments.filter(a => a.personId === workerId && a.status !== 'cancelled' && a.status !== 'reassigned'),
    [workerId, v],
  );

  const checkInList = useMemo(() => db.checkIns.filter(c => c.personId === workerId), [workerId, v]);
  const checkOutList = useMemo(() => db.checkOuts.filter(c => c.personId === workerId), [workerId, v]);
  const activityList = useMemo(() => db.workerActivities.filter(a => a.personId === workerId), [workerId, v]);
  const workerSettings = useMemo(() => db.workerSettings, [v]);

  const [localTaskPhotos, setLocalTaskPhotos] = useState<Record<string, boolean>>({});
  const [taskPhotoUris, setTaskPhotoUris] = useState<Record<string, string>>({});
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [offlineQueue] = useState<OfflineAction[]>([]);
  const [isOnline] = useState(true);

  const getAssignmentStatus = useCallback((a: Assignment) => a.status, []);

  const todayAssignments = useMemo(() =>
    allAssignments
      .filter(a => a.scheduledDate === today)
      .sort((a, b) => {
        if (a.isFullDay && !b.isFullDay) return 1;
        if (!a.isFullDay && b.isFullDay) return -1;
        return (a.startTime ?? '').localeCompare(b.startTime ?? '');
      }),
    [allAssignments, today],
  );

  const upcomingAssignments = useMemo(() =>
    allAssignments
      .filter(a => a.scheduledDate > today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.sortOrder - b.sortOrder),
    [allAssignments, today],
  );

  const completedAssignments = useMemo(() =>
    allAssignments
      .filter(a => a.scheduledDate < today || a.status === 'completed')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [allAssignments, today],
  );

  const currentJob = useMemo(() => {
    if (currentJobId) return todayAssignments.find(a => a.id === currentJobId) ?? null;
    return todayAssignments.find(a => a.status === 'checked_in' || a.status === 'working') ?? null;
  }, [todayAssignments, currentJobId]);

  const nextJob = useMemo(() => {
    if (!currentJob) return todayAssignments.find(a => a.status !== 'completed') ?? null;
    const idx = todayAssignments.findIndex(a => a.id === currentJob.id);
    return todayAssignments.slice(idx + 1).find(a => a.status !== 'completed') ?? null;
  }, [todayAssignments, currentJob]);

  // Where the worker is with the current job, from the saved assignment status
  // (so it survives closing the app).
  const jobState = useMemo<JobState>(() => {
    if (!currentJob) return 'not_started';
    if (currentJob.status === 'checked_in') return 'checked_in';
    if (currentJob.status === 'working') return 'working';
    if (currentJob.status === 'completed') return 'completed';
    return 'not_started';
  }, [currentJob]);

  const scheduleConfirmed = useMemo(() =>
    todayAssignments.length > 0 && todayAssignments.every(a => a.confirmationState === 'confirmed'),
    [todayAssignments],
  );

  const hasScheduleChanges = useMemo(() =>
    todayAssignments.some(a =>
      a.confirmationState === 'updated_since' || a.confirmationState === 'awaiting',
    ),
    [todayAssignments],
  );

  const logActivity = useCallback((activity: Omit<WorkerActivity, 'id' | 'companyId' | 'personId' | 'timestamp' | 'project'>) => {
    insertRow('worker_activities', { ...activity, personId: workerId, timestamp: new Date().toISOString() });
  }, [workerId]);

  const workerName = user ? `${user.firstName} ${user.lastName}`.trim() : 'A worker';

  const confirmSchedule = useCallback(() => {
    for (const a of todayAssignments) {
      if (a.confirmationState !== 'confirmed') updateRow('assignments', a.id, { confirmationState: 'confirmed' });
    }
    logActivity({ activityType: 'schedule_confirmed', description: 'Confirmed today\'s schedule' });
  }, [todayAssignments, logActivity]);

  const acknowledgeChanges = useCallback(() => {
    for (const a of todayAssignments) {
      if (a.confirmationState === 'updated_since' || a.confirmationState === 'awaiting') {
        updateRow('assignments', a.id, { confirmationState: 'confirmed' });
      }
    }
    logActivity({ activityType: 'schedule_acknowledged', description: 'Acknowledged schedule changes' });
  }, [todayAssignments, logActivity]);

  const isWithinRadius = useCallback((gps: GPSCoordinates, projectId: string) => {
    const settings = db.settings[projectId];
    if (!settings?.checkinRadiusMeters) return true;
    const project = db.projects.find(p => p.id === projectId);
    if (!project?.latitude || !project?.longitude) return true;
    const R = 6371000;
    const dLat = (project.latitude - gps.latitude) * Math.PI / 180;
    const dLon = (project.longitude - gps.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(gps.latitude * Math.PI / 180) *
      Math.cos(project.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distance <= settings.checkinRadiusMeters;
  }, []);

  const checkIn = useCallback((gps: GPSCoordinates) => {
    const job = currentJob && currentJob.status !== 'completed'
      ? currentJob
      : todayAssignments.find(a => a.status !== 'completed');
    if (!job) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const withinRadius = isWithinRadius(gps, job.projectId);
    const projectName = job.project?.name ?? 'job site';

    insertRow('check_ins', {
      assignmentId: job.id, personId: workerId, projectId: job.projectId,
      timestamp: nowIso, gps, withinRadius,
    });
    insertRow('work_sessions', {
      personId: workerId, projectId: job.projectId, assignmentId: job.id,
      checkInTime: nowIso, checkInGps: gps, status: 'active',
    });
    updateRow('assignments', job.id, { status: 'checked_in' });
    setCurrentJobId(job.id);
    logActivity({ assignmentId: job.id, projectId: job.projectId, activityType: 'checked_in', description: `Checked in at ${projectName}` });

    // Tell the owner.
    const link = { type: 'assignment' as const, id: job.id };
    const late = !job.isFullDay && job.startTime
      ? now.getTime() > localDateTime(job.scheduledDate, job.startTime).getTime() + (db.operationsSettings.lateCheckinThresholdMinutes ?? 0) * 60000
      : false;
    if (late) {
      notifyStaff('worker_checked_in_late', 'Late check-in', `${workerName} checked in late at ${projectName} (scheduled ${job.startTime}).`, link, undefined, workerId);
    } else {
      notifyStaff('worker_checked_in', 'Worker checked in', `${workerName} checked in at ${projectName}.`, link, undefined, workerId);
    }
    if (!withinRadius) {
      notifyStaff('worker_outside_radius', 'Check-in outside job site', `${workerName} checked in away from ${projectName}.`, link, undefined, workerId);
    }
  }, [currentJob, todayAssignments, workerId, isWithinRadius, logActivity, workerName]);

  const checkOut = useCallback((gps: GPSCoordinates) => {
    const job = currentJob;
    if (!job) return;

    const nowIso = new Date().toISOString();
    const projectName = job.project?.name ?? 'job site';
    insertRow('check_outs', {
      assignmentId: job.id, personId: workerId, projectId: job.projectId,
      timestamp: nowIso, gps,
    });
    const session = db.workSessions.find(s => s.assignmentId === job.id && s.personId === workerId && s.status === 'active');
    if (session) {
      const minutes = Math.max(0, Math.round((Date.now() - new Date(session.checkInTime).getTime()) / 60000));
      updateRow('work_sessions', session.id, {
        checkOutTime: nowIso, checkOutGps: gps, durationMinutes: minutes, status: 'completed',
      });
    }
    updateRow('assignments', job.id, { status: 'completed' });
    logActivity({ assignmentId: job.id, projectId: job.projectId, activityType: 'checked_out', description: `Checked out from ${projectName}` });
    notifyStaff('worker_checked_out', 'Worker checked out', `${workerName} checked out from ${projectName}.`, { type: 'assignment', id: job.id }, undefined, workerId);
  }, [currentJob, workerId, logActivity, workerName]);

  const moveToNextJob = useCallback(() => {
    setCurrentJobId(nextJob ? nextJob.id : null);
  }, [nextJob]);

  const projectTasksFn = useCallback((projectId: string): ProjectTask[] =>
    db.tasks[projectId] ?? [], [v]);

  const startTask = useCallback((taskId: string) => {
    const task = findRow('project_tasks', taskId);
    updateRow('project_tasks', taskId, { status: 'in_progress' });
    if (currentJob?.status === 'checked_in') updateRow('assignments', currentJob.id, { status: 'working' });
    logActivity({
      assignmentId: currentJob?.id, projectId: task?.projectId,
      activityType: 'task_started', description: `Started: ${task?.title ?? 'task'}`,
    });
  }, [currentJob, logActivity]);

  const completeTask = useCallback((taskId: string) => {
    const task = findRow('project_tasks', taskId);
    updateRow('project_tasks', taskId, { status: 'completed', completedAt: new Date().toISOString() });
    logActivity({
      assignmentId: currentJob?.id, projectId: task?.projectId,
      activityType: 'task_completed', description: `Completed: ${task?.title ?? 'task'}`,
    });
    if (task?.projectId) {
      logProjectHistory(task.projectId, 'task_completed', `Task completed: ${task.title}`, { taskId });
      const projectName = db.projects.find(p => p.id === task.projectId)?.name ?? 'a project';
      notifyStaff('worker_completed_task', 'Task completed', `${workerName} completed "${task.title}" at ${projectName}.`, { type: 'project', id: task.projectId }, undefined, workerId);
    }
  }, [currentJob, logActivity, workerName]);

  const projectSettingsFn = useCallback((projectId: string) =>
    db.settings[projectId], [v]);

  // A task counts as photographed once a photo is attached to it (from this
  // device or saved earlier).
  const taskPhotos = useMemo(() => {
    const out: Record<string, boolean> = { ...localTaskPhotos };
    for (const list of Object.values(db.photos)) {
      for (const ph of list) if (ph.taskId) out[ph.taskId] = true;
    }
    return out;
  }, [localTaskPhotos, v]);

  const captureTaskPhoto = useCallback((taskId: string, uri?: string) => {
    setLocalTaskPhotos(prev => ({ ...prev, [taskId]: true }));
    if (uri) setTaskPhotoUris(prev => ({ ...prev, [taskId]: uri }));
    const task = findRow('project_tasks', taskId);
    const projectId = task?.projectId ?? currentJob?.projectId;
    let photoId: string | undefined;
    if (uri && projectId) {
      photoId = addProjectPhoto({
        projectId,
        taskId,
        assignmentId: currentJob?.id,
        uploadedBy: workerId,
        fileUrl: uri,
        isCustomerVisible: false,
        photoType: 'progress',
        takenAt: new Date().toISOString(),
      }).id;
      notifyStaff('photo_waiting_review', 'New photo to review', `${workerName} added a photo for "${task?.title ?? 'a task'}".`, { type: 'project', id: projectId }, undefined, workerId);
    }
    logActivity({
      assignmentId: currentJob?.id, projectId,
      activityType: 'photo_taken', description: 'Completion photo captured',
      metadata: photoId ? { photoId } : undefined,
    });
  }, [workerId, currentJob, logActivity, workerName]);

  const updateNavApp = useCallback((app: NavAppPreference) => {
    upsertRow('worker_settings', { personId: workerId, navApp: app, notificationsEnabled: db.workerSettings.notificationsEnabled });
  }, [workerId]);

  const updateNotificationsEnabled = useCallback((enabled: boolean) => {
    upsertRow('worker_settings', { personId: workerId, navApp: db.workerSettings.navApp, notificationsEnabled: enabled });
  }, [workerId]);

  const openMapsNavigation = useCallback((address: string) => {
    const encoded = encodeURIComponent(address);
    let url = '';
    switch (workerSettings.navApp) {
      case 'google_maps':
        url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
        break;
      case 'waze':
        url = `https://waze.com/ul?q=${encoded}&navigate=yes`;
        break;
      case 'apple_maps':
        url = `https://maps.apple.com/?daddr=${encoded}`;
        break;
      default:
        url = Platform.OS === 'ios'
          ? `https://maps.apple.com/?daddr=${encoded}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    }
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return;
    }
    // https links hand off to the installed app (Google Maps, Waze, Apple
    // Maps) via universal links, or fall back to the browser if it's missing.
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open maps', address);
    });
  }, [workerSettings.navApp]);

  const value = useMemo<WorkerContextValue>(() => ({
    todayAssignments,
    upcomingAssignments,
    completedAssignments,
    currentJob,
    nextJob,
    jobState,
    scheduleConfirmed,
    hasScheduleChanges,
    confirmSchedule,
    acknowledgeChanges,
    checkIn,
    checkOut,
    isWithinRadius,
    checkIns: checkInList,
    checkOuts: checkOutList,
    projectTasks: projectTasksFn,
    startTask,
    completeTask,
    projectSettings: projectSettingsFn,
    taskPhotoCaptured: taskPhotos,
    taskPhotoUris,
    captureTaskPhoto,
    activities: activityList,
    settings: workerSettings,
    updateNavApp,
    updateNotificationsEnabled,
    offlineQueue,
    isOnline,
    openMapsNavigation,
    moveToNextJob,
  }), [
    todayAssignments, upcomingAssignments, completedAssignments,
    currentJob, nextJob, jobState, scheduleConfirmed, hasScheduleChanges,
    confirmSchedule, acknowledgeChanges,
    checkIn, checkOut, isWithinRadius, checkInList, checkOutList,
    projectTasksFn, startTask, completeTask, projectSettingsFn,
    taskPhotos, taskPhotoUris, captureTaskPhoto, activityList, workerSettings,
    updateNavApp, updateNotificationsEnabled, offlineQueue, isOnline, openMapsNavigation, moveToNextJob,
  ]);

  return <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>;
}
