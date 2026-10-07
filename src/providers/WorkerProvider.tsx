import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthProvider';
import {
  mockAssignments,
  mockTasks,
  mockSettings,
  mockWorkerActivities,
  mockCheckIns,
  mockCheckOuts,
  mockWorkerSettings,
  mockProjects,
} from '@/data/mock';
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
  const workerId = user?.id ?? 'worker1';

  const today = new Date().toISOString().split('T')[0];

  const allAssignments = useMemo(() =>
    mockAssignments.filter(a => a.personId === workerId && a.status !== 'cancelled'),
    [workerId],
  );

  const [assignmentStatuses, setAssignmentStatuses] = useState<Record<string, Assignment['status']>>({});
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [changesAcknowledged, setChangesAcknowledged] = useState(false);
  const [checkInList, setCheckInList] = useState<CheckIn[]>(
    mockCheckIns.filter(c => c.personId === workerId),
  );
  const [checkOutList, setCheckOutList] = useState<CheckOut[]>(
    mockCheckOuts.filter(c => c.personId === workerId),
  );
  const [taskStates, setTaskStates] = useState<Record<string, ProjectTask['status']>>({});
  const [taskPhotos, setTaskPhotos] = useState<Record<string, boolean>>({});
  const [taskPhotoUris, setTaskPhotoUris] = useState<Record<string, string>>({});
  const [activityList, setActivityList] = useState<WorkerActivity[]>(
    mockWorkerActivities.filter(a => a.personId === workerId),
  );
  const [workerSettings, setWorkerSettings] = useState<WorkerSettings>(mockWorkerSettings);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState>('not_started');
  const [offlineQueue] = useState<OfflineAction[]>([]);
  const [isOnline] = useState(true);

  const getAssignmentStatus = useCallback((a: Assignment) =>
    assignmentStatuses[a.id] ?? a.status, [assignmentStatuses]);

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
      .filter(a => a.scheduledDate < today || getAssignmentStatus(a) === 'completed')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [allAssignments, today, getAssignmentStatus],
  );

  const currentJob = useMemo(() => {
    if (currentJobId) return todayAssignments.find(a => a.id === currentJobId) ?? null;
    return todayAssignments.find(a => {
      const s = getAssignmentStatus(a);
      return s === 'checked_in' || s === 'working';
    }) ?? null;
  }, [todayAssignments, currentJobId, getAssignmentStatus]);

  const nextJob = useMemo(() => {
    if (!currentJob) return todayAssignments[0] ?? null;
    const idx = todayAssignments.findIndex(a => a.id === currentJob.id);
    return todayAssignments[idx + 1] ?? null;
  }, [todayAssignments, currentJob]);

  const hasScheduleChanges = useMemo(() =>
    todayAssignments.some(a =>
      a.confirmationState === 'updated_since' || a.confirmationState === 'awaiting',
    ),
    [todayAssignments],
  );

  const confirmSchedule = useCallback(() => {
    setScheduleConfirmed(true);
    const now = new Date().toISOString();
    setActivityList(prev => [{
      id: `wa-confirm-${Date.now()}`, personId: workerId, companyId: 'company1',
      activityType: 'schedule_confirmed', description: 'Confirmed today\'s schedule',
      timestamp: now,
    }, ...prev]);
  }, [workerId]);

  const acknowledgeChanges = useCallback(() => {
    setChangesAcknowledged(true);
    const now = new Date().toISOString();
    setActivityList(prev => [{
      id: `wa-ack-${Date.now()}`, personId: workerId, companyId: 'company1',
      activityType: 'schedule_acknowledged', description: 'Acknowledged schedule changes',
      timestamp: now,
    }, ...prev]);
  }, [workerId]);

  const isWithinRadius = useCallback((gps: GPSCoordinates, projectId: string) => {
    const settings = mockSettings[projectId];
    if (!settings?.checkinRadiusMeters) return true;
    const project = mockProjects.find(p => p.id === projectId);
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
    const job = currentJob ?? todayAssignments.find(a => getAssignmentStatus(a) !== 'completed');
    if (!job) return;

    const now = new Date().toISOString();
    const newCheckIn: CheckIn = {
      id: `ci-${Date.now()}`,
      assignmentId: job.id,
      personId: workerId,
      projectId: job.projectId,
      companyId: 'company1',
      timestamp: now,
      gps,
      withinRadius: isWithinRadius(gps, job.projectId),
      createdAt: now,
    };

    setCheckInList(prev => [...prev, newCheckIn]);
    setAssignmentStatuses(prev => ({ ...prev, [job.id]: 'checked_in' }));
    setCurrentJobId(job.id);
    setJobState('checked_in');

    setActivityList(prev => [{
      id: `wa-ci-${Date.now()}`, personId: workerId, companyId: 'company1',
      assignmentId: job.id, projectId: job.projectId,
      activityType: 'checked_in',
      description: `Checked in at ${job.project?.name ?? 'job site'}`,
      timestamp: now,
      project: job.project ? { id: job.project.id, name: job.project.name } : undefined,
    }, ...prev]);
  }, [currentJob, todayAssignments, workerId, getAssignmentStatus, isWithinRadius]);

  const checkOut = useCallback((gps: GPSCoordinates) => {
    const job = currentJob;
    if (!job) return;

    const now = new Date().toISOString();
    const newCheckOut: CheckOut = {
      id: `co-${Date.now()}`,
      assignmentId: job.id,
      personId: workerId,
      projectId: job.projectId,
      companyId: 'company1',
      timestamp: now,
      gps,
      createdAt: now,
    };

    setCheckOutList(prev => [...prev, newCheckOut]);
    setAssignmentStatuses(prev => ({ ...prev, [job.id]: 'completed' }));
    setJobState('completed');

    setActivityList(prev => [{
      id: `wa-co-${Date.now()}`, personId: workerId, companyId: 'company1',
      assignmentId: job.id, projectId: job.projectId,
      activityType: 'checked_out',
      description: `Checked out from ${job.project?.name ?? 'job site'}`,
      timestamp: now,
      project: job.project ? { id: job.project.id, name: job.project.name } : undefined,
    }, ...prev]);
  }, [currentJob, workerId]);

  const moveToNextJob = useCallback(() => {
    if (nextJob) {
      setCurrentJobId(nextJob.id);
      setJobState('not_started');
    } else {
      setCurrentJobId(null);
      setJobState('not_started');
    }
  }, [nextJob]);

  const projectTasksFn = useCallback((projectId: string): ProjectTask[] => {
    const tasks = mockTasks[projectId] ?? [];
    return tasks.map(t => ({
      ...t,
      status: taskStates[t.id] ?? t.status,
    }));
  }, [taskStates]);

  const startTask = useCallback((taskId: string) => {
    setTaskStates(prev => ({ ...prev, [taskId]: 'in_progress' }));
    if (jobState === 'checked_in') setJobState('working');

    const allTasks = Object.values(mockTasks).flat();
    const task = allTasks.find(t => t.id === taskId);
    const now = new Date().toISOString();

    setActivityList(prev => [{
      id: `wa-ts-${Date.now()}`, personId: workerId, companyId: 'company1',
      assignmentId: currentJob?.id, projectId: task?.projectId,
      activityType: 'task_started',
      description: `Started: ${task?.title ?? 'task'}`,
      timestamp: now,
      project: currentJob?.project ? { id: currentJob.project.id, name: currentJob.project.name } : undefined,
    }, ...prev]);
  }, [workerId, currentJob, jobState]);

  const completeTask = useCallback((taskId: string) => {
    setTaskStates(prev => ({ ...prev, [taskId]: 'completed' }));

    const allTasks = Object.values(mockTasks).flat();
    const task = allTasks.find(t => t.id === taskId);
    const now = new Date().toISOString();

    setActivityList(prev => [{
      id: `wa-tc-${Date.now()}`, personId: workerId, companyId: 'company1',
      assignmentId: currentJob?.id, projectId: task?.projectId,
      activityType: 'task_completed',
      description: `Completed: ${task?.title ?? 'task'}`,
      timestamp: now,
      project: currentJob?.project ? { id: currentJob.project.id, name: currentJob.project.name } : undefined,
    }, ...prev]);
  }, [workerId, currentJob]);

  const projectSettingsFn = useCallback((projectId: string) =>
    mockSettings[projectId], []);

  const captureTaskPhoto = useCallback((taskId: string, uri?: string) => {
    setTaskPhotos(prev => ({ ...prev, [taskId]: true }));
    if (uri) setTaskPhotoUris(prev => ({ ...prev, [taskId]: uri }));
    const now = new Date().toISOString();
    setActivityList(prev => [{
      id: `wa-ph-${Date.now()}`, personId: workerId, companyId: 'company1',
      assignmentId: currentJob?.id, projectId: currentJob?.projectId,
      activityType: 'photo_taken',
      description: 'Completion photo captured',
      timestamp: now,
      project: currentJob?.project ? { id: currentJob.project.id, name: currentJob.project.name } : undefined,
    }, ...prev]);
  }, [workerId, currentJob]);

  const updateNavApp = useCallback((app: NavAppPreference) => {
    setWorkerSettings(prev => ({ ...prev, navApp: app }));
  }, []);

  const updateNotificationsEnabled = useCallback((enabled: boolean) => {
    setWorkerSettings(prev => ({ ...prev, notificationsEnabled: enabled }));
  }, []);

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
    }
  }, [workerSettings.navApp]);

  const value = useMemo<WorkerContextValue>(() => ({
    todayAssignments,
    upcomingAssignments,
    completedAssignments,
    currentJob,
    nextJob,
    jobState,
    scheduleConfirmed,
    hasScheduleChanges: hasScheduleChanges && !changesAcknowledged,
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
    changesAcknowledged, confirmSchedule, acknowledgeChanges,
    checkIn, checkOut, isWithinRadius, checkInList, checkOutList,
    projectTasksFn, startTask, completeTask, projectSettingsFn,
    taskPhotos, taskPhotoUris, captureTaskPhoto, activityList, workerSettings,
    updateNavApp, updateNotificationsEnabled, offlineQueue, isOnline, openMapsNavigation, moveToNextJob,
  ]);

  return <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>;
}
