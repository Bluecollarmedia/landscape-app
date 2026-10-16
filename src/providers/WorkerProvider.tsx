import { openDirections, findCoords, distanceMeters, formatDistance, DEFAULT_CHECKIN_RADIUS_M, type Place } from '@/lib/maps';
import { getCurrentGps } from '@/lib/location';
import { isSupabaseConfigured } from '@/lib/supabase';
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useAuth } from './AuthProvider';
import { db, useDb, insertRow, updateRow, upsertRow, findRow } from '@/data/store';
import { addProjectPhoto, logProjectHistory, notifyStaff } from '@/data/actions';
import { todayKey, localDateTime } from '@/lib/ids';
import type { Assignment } from '@/types/schedule';
import type { ProjectTask, ProjectSettings } from '@/types/project';
import type { PersonSummary } from '@/types/company';
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

export type CheckInLocation =
  | { ok: true; gps: GPSCoordinates | null }
  | { ok: false; title: string; message: string; openSettings?: boolean };

/** Demo mode has no real phone location; pretend the worker is on site. */
const DEMO_GPS: GPSCoordinates = { latitude: 41.4756, longitude: -81.5558, accuracy: 10, distanceFromSite: 20 };

/** GPS readings near trees and buildings drift; never count more than this much of the phone's error margin. */
const MAX_ACCURACY_ALLOWANCE_M = 75;

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

  /** Checks in to the given job (or the current/next one). Works again after checking out, to resume a job. */
  checkIn: (gps: GPSCoordinates | null, assignmentId?: string) => void;
  checkOut: (gps: GPSCoordinates | null) => void;
  /** Reads the phone's location and checks it against the job site. Check-in is only allowed when ok. */
  locateForCheckIn: (assignmentId?: string) => Promise<CheckInLocation>;
  /** Reads the phone's location for check-out (never blocks). */
  locateForCheckOut: () => Promise<GPSCoordinates | null>;
  checkIns: CheckIn[];
  checkOuts: CheckOut[];

  projectTasks: (projectId: string) => ProjectTask[];
  /** The job's Task Lead, if the owner picked one. */
  taskLead: (projectId: string) => PersonSummary | undefined;
  /** Only the job's Task Lead can start, complete or reopen its tasks. */
  canChangeTasks: (projectId: string) => boolean;
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

  openMapsNavigation: (place: Place) => void;
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
      // Today's unfinished jobs count as upcoming too, so My Jobs never looks empty on the day of a job.
      .filter(a => a.scheduledDate > today || (a.scheduledDate === today && a.status !== 'completed'))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.sortOrder - b.sortOrder),
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

  /** The job "I'm here" applies to: the given one, else the current/next unfinished one, else the last (to resume). */
  const resolveCheckInJob = useCallback((assignmentId?: string) =>
    (assignmentId && allAssignments.find(a => a.id === assignmentId))
      || (currentJob && currentJob.status !== 'completed' ? currentJob : undefined)
      || todayAssignments.find(a => a.status !== 'completed')
      // Everything's checked out: let them check back in to the job they just left.
      || currentJob
      || todayAssignments[todayAssignments.length - 1],
  [allAssignments, currentJob, todayAssignments]);

  const locateForCheckIn = useCallback(async (assignmentId?: string): Promise<CheckInLocation> => {
    if (!isSupabaseConfigured) return { ok: true, gps: DEMO_GPS };
    const job = resolveCheckInJob(assignmentId);
    if (!job) return { ok: true, gps: null };

    const here = await getCurrentGps();
    if (here.status === 'denied') {
      return {
        ok: false,
        title: 'Turn on location',
        message: 'Brighton Lawn needs your location to check you in at the job site. Turn it on in Settings, then try again.',
        openSettings: true,
      };
    }
    if (here.status === 'unavailable') {
      return {
        ok: false,
        title: 'Can’t find your location',
        message: 'Your phone couldn’t get a GPS fix. Step outside or wait a moment, then try again.',
      };
    }

    const gps = here.gps;
    const radius = db.settings[job.projectId]?.checkinRadiusMeters ?? DEFAULT_CHECKIN_RADIUS_M;
    const site = job.project ? await findCoords(job.project) : null;
    // If the job's address can't be found on the map there's nothing to compare against, so allow it.
    if (!site) return { ok: true, gps };

    const distance = Math.round(distanceMeters(gps, site));
    const withDistance = { ...gps, distanceFromSite: distance };

    const allowance = Math.min(gps.accuracy || 0, MAX_ACCURACY_ALLOWANCE_M);
    if (distance - allowance <= radius) return { ok: true, gps: withDistance };

    return {
      ok: false,
      title: 'You’re not at the job site yet',
      message: `You’re about ${formatDistance(distance)} from ${job.project?.name ?? 'the job site'}. Check in once you get there.`,
    };
  }, [resolveCheckInJob]);

  const locateForCheckOut = useCallback(async (): Promise<GPSCoordinates | null> => {
    if (!isSupabaseConfigured) return DEMO_GPS;
    const here = await getCurrentGps();
    if (here.status !== 'ok') return null;
    const site = currentJob?.project ? await findCoords(currentJob.project) : null;
    return site ? { ...here.gps, distanceFromSite: Math.round(distanceMeters(here.gps, site)) } : here.gps;
  }, [currentJob]);

  const checkIn = useCallback((gps: GPSCoordinates | null, assignmentId?: string) => {
    const job = resolveCheckInJob(assignmentId);
    if (!job) return;
    const resuming = job.status === 'completed';

    const now = new Date();
    const nowIso = now.toISOString();
    // locateForCheckIn already refused anyone outside the job's distance.
    const withinRadius = true;
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
    logActivity({ assignmentId: job.id, projectId: job.projectId, activityType: 'checked_in', description: `${resuming ? 'Checked back in' : 'Checked in'} at ${projectName}` });

    // Tell the owner.
    const link = { type: 'assignment' as const, id: job.id };
    const late = !job.isFullDay && job.startTime
      ? now.getTime() > localDateTime(job.scheduledDate, job.startTime).getTime() + (db.operationsSettings.lateCheckinThresholdMinutes ?? 0) * 60000
      : false;
    if (resuming) {
      notifyStaff('worker_checked_in', 'Worker checked back in', `${workerName} checked back in at ${projectName}.`, link, undefined, workerId);
    } else if (late) {
      notifyStaff('worker_checked_in_late', 'Late check-in', `${workerName} checked in late at ${projectName} (scheduled ${job.startTime}).`, link, undefined, workerId);
    } else {
      notifyStaff('worker_checked_in', 'Worker checked in', `${workerName} checked in at ${projectName}.`, link, undefined, workerId);
    }
  }, [resolveCheckInJob, workerId, logActivity, workerName]);

  const checkOut = useCallback((gps: GPSCoordinates | null) => {
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

  const taskLeadFn = useCallback((projectId: string) =>
    db.projects.find(p => p.id === projectId)?.taskLead, [v]);

  const canChangeTasksFn = useCallback((projectId: string) =>
    !!workerId && db.projects.find(p => p.id === projectId)?.taskLeadId === workerId, [v, workerId]);

  const startTask = useCallback((taskId: string) => {
    const task = findRow('project_tasks', taskId);
    if (!task || !canChangeTasksFn(task.projectId)) return;
    updateRow('project_tasks', taskId, { status: 'in_progress' });
    if (currentJob?.status === 'checked_in') updateRow('assignments', currentJob.id, { status: 'working' });
    logActivity({
      assignmentId: currentJob?.id, projectId: task?.projectId,
      activityType: 'task_started', description: `Started: ${task?.title ?? 'task'}`,
    });
  }, [currentJob, logActivity, canChangeTasksFn]);

  const completeTask = useCallback((taskId: string) => {
    const task = findRow('project_tasks', taskId);
    if (!task || !canChangeTasksFn(task.projectId)) return;
    // The database stamps the real time and person (update 016).
    updateRow('project_tasks', taskId, { status: 'completed', completedAt: new Date().toISOString(), completedBy: workerId });
    logActivity({
      assignmentId: currentJob?.id, projectId: task?.projectId,
      activityType: 'task_completed', description: `Completed: ${task?.title ?? 'task'}`,
    });
    if (task.projectId) {
      logProjectHistory(task.projectId, 'task_completed', `Task completed: ${task.title}`, { taskId });
      const projectName = db.projects.find(p => p.id === task.projectId)?.name ?? 'a project';
      notifyStaff('worker_completed_task', 'Task completed', `${workerName} completed "${task.title}" at ${projectName}.`, { type: 'project', id: task.projectId }, undefined, workerId);
    }
  }, [currentJob, logActivity, workerName, workerId, canChangeTasksFn]);

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

  const openMapsNavigation = useCallback((place: Place) => {
    openDirections(place, workerSettings.navApp);
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
    locateForCheckIn,
    locateForCheckOut,
    checkIns: checkInList,
    checkOuts: checkOutList,
    projectTasks: projectTasksFn,
    taskLead: taskLeadFn,
    canChangeTasks: canChangeTasksFn,
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
    checkIn, checkOut, locateForCheckIn, locateForCheckOut, checkInList, checkOutList,
    projectTasksFn, taskLeadFn, canChangeTasksFn, startTask, completeTask, projectSettingsFn,
    taskPhotos, taskPhotoUris, captureTaskPhoto, activityList, workerSettings,
    updateNavApp, updateNotificationsEnabled, offlineQueue, isOnline, openMapsNavigation, moveToNextJob,
  ]);

  return <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>;
}
