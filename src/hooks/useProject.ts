import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Project, ProjectTask, ProjectTeamMember, ProjectSettings, ProjectHistoryEntry, ProjectUpdate, ProjectRequest, ProjectPhoto, CustomerTimelineEvent } from '@/types/project';
import { mockProjects, mockTasks, mockTeam, mockSettings, mockHistory, mockUpdates, mockRequests, mockProjectPhotos, mockCustomerTimeline, mockPeople } from '@/data/mock';

export function useProject(projectId: string) {
  const project = useMemo(
    () => mockProjects.find((p) => p.id === projectId) ?? null,
    [projectId],
  );

  // Real state (not useMemo) so task mutations produce a new array reference
  // and every derived value (taskStats, filtered sections) recomputes — the
  // same shape this will have once tasks come from a real backend query.
  const [tasks, setTasks] = useState<ProjectTask[]>(() => mockTasks[projectId] ?? []);
  useEffect(() => {
    setTasks(mockTasks[projectId] ?? []);
  }, [projectId]);

  const addTask = useCallback((input: Omit<ProjectTask, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => {
    const newTask: ProjectTask = {
      ...input,
      id: `t_${Date.now()}`,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks((prev) => {
      const next = [...prev, newTask];
      mockTasks[projectId] = next;
      return next;
    });
    return newTask;
  }, [projectId]);

  const updateTask = useCallback((taskId: string, updates: Partial<ProjectTask>) => {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
      );
      mockTasks[projectId] = next;
      return next;
    });
  }, [projectId]);

  // Real state (not useMemo) so adding/removing a team member produces a
  // new array reference and any consumer (team count, rosters) recomputes.
  const [team, setTeam] = useState<ProjectTeamMember[]>(() => mockTeam[projectId] ?? []);
  useEffect(() => {
    setTeam(mockTeam[projectId] ?? []);
  }, [projectId]);

  const addTeamMember = useCallback((personId: string) => {
    setTeam((prev) => {
      if (prev.some((tm) => tm.personId === personId)) return prev;
      const newMember: ProjectTeamMember = {
        id: `tm_${Date.now()}`,
        projectId,
        personId,
        addedAt: new Date().toISOString(),
        person: mockPeople[personId],
      };
      const next = [...prev, newMember];
      mockTeam[projectId] = next;
      return next;
    });
  }, [projectId]);

  const removeTeamMember = useCallback((personId: string) => {
    setTeam((prev) => {
      const next = prev.filter((tm) => tm.personId !== personId);
      mockTeam[projectId] = next;
      return next;
    });
  }, [projectId]);

  // Real state (not useMemo) so Customer Settings toggles produce a new
  // object reference and any consumer relying on it re-renders.
  const [settings, setSettings] = useState<ProjectSettings | null>(() => mockSettings[projectId] ?? null);
  useEffect(() => {
    setSettings(mockSettings[projectId] ?? null);
  }, [projectId]);

  const updateSettings = useCallback((updates: Partial<ProjectSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates, updatedAt: new Date().toISOString() };
      mockSettings[projectId] = next;
      return next;
    });
  }, [projectId]);

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

  // Same reasoning as tasks: real state so sharing/unsharing/adding/deleting
  // a photo produces a new array reference and photoStats recomputes.
  const [photos, setPhotos] = useState<ProjectPhoto[]>(() =>
    (mockProjectPhotos[projectId] ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  useEffect(() => {
    setPhotos((mockProjectPhotos[projectId] ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [projectId]);

  const addPhoto = useCallback((input: Omit<ProjectPhoto, 'id' | 'projectId' | 'createdAt'>) => {
    const newPhoto: ProjectPhoto = {
      ...input,
      id: `ph_${Date.now()}`,
      projectId,
      createdAt: new Date().toISOString(),
    };
    setPhotos((prev) => {
      const next = [newPhoto, ...prev];
      mockProjectPhotos[projectId] = next;
      return next;
    });
    return newPhoto;
  }, [projectId]);

  const updatePhoto = useCallback((photoId: string, updates: Partial<ProjectPhoto>) => {
    setPhotos((prev) => {
      const next = prev.map((ph) => (ph.id === photoId ? { ...ph, ...updates } : ph));
      mockProjectPhotos[projectId] = next;
      return next;
    });
  }, [projectId]);

  const deletePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => {
      const next = prev.filter((ph) => ph.id !== photoId);
      mockProjectPhotos[projectId] = next;
      return next;
    });
  }, [projectId]);

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

  return {
    project, tasks, addTask, updateTask, team, addTeamMember, removeTeamMember, settings, updateSettings, history, updates, requests,
    photos, addPhoto, updatePhoto, deletePhoto,
    customerTimeline, taskStats, photoStats,
  };
}
