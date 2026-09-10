import { useState, useMemo, useCallback } from 'react';
import type { Project, ProjectTask, ProjectTeamMember, ProjectSettings, ProjectHistoryEntry, ProjectUpdate, ProjectRequest, ProjectPhoto, CustomerTimelineEvent } from '@/types/project';
import { mockProjects, mockTasks, mockTeam, mockSettings, mockHistory, mockUpdates, mockRequests, mockProjectPhotos, mockCustomerTimeline } from '@/data/mock';

export function useProject(projectId: string) {
  const project = useMemo(
    () => mockProjects.find((p) => p.id === projectId) ?? null,
    [projectId],
  );

  const tasks = useMemo(() => mockTasks[projectId] ?? [], [projectId]);
  const team = useMemo(() => mockTeam[projectId] ?? [], [projectId]);
  const settings = useMemo(() => mockSettings[projectId] ?? null, [projectId]);
  const history = useMemo(
    () => (mockHistory[projectId] ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [projectId],
  );
  const updates = useMemo(
    () => (mockUpdates[projectId] ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [projectId],
  );
  const requests = useMemo(
    () => (mockRequests[projectId] ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [projectId],
  );

  const photos = useMemo(
    () => (mockProjectPhotos[projectId] ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [projectId],
  );

  const customerTimeline = useMemo(
    () => (mockCustomerTimeline[projectId] ?? []).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [projectId],
  );

  const photoStats = useMemo(() => {
    const all = photos;
    const total = all.length;
    const shared = all.filter((p) => p.isCustomerVisible).length;
    const unreviewed = all.filter((p) => !p.isCustomerVisible).length;
    return { total, shared, unreviewed };
  }, [photos]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    return { total, completed, inProgress, pending };
  }, [tasks]);

  return { project, tasks, team, settings, history, updates, requests, photos, customerTimeline, taskStats, photoStats };
}
