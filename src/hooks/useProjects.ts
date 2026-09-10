import { useState, useMemo, useCallback } from 'react';
import type { Project, ProjectStatus } from '@/types/project';
import { mockProjects } from '@/data/mock';

interface UseProjectsOptions {
  search?: string;
  statusFilter?: ProjectStatus | 'all';
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { search = '', statusFilter = 'all' } = options;
  const [projects, setProjects] = useState<Project[]>(mockProjects);

  const filtered = useMemo(() => {
    let result = projects;

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.customer?.firstName.toLowerCase().includes(q) ||
          p.customer?.lastName.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [projects, search, statusFilter]);

  const grouped = useMemo(() => {
    const groups: Record<ProjectStatus, Project[]> = {
      active: [],
      on_hold: [],
      completed: [],
      archived: [],
    };
    for (const p of filtered) {
      groups[p.status].push(p);
    }
    return groups;
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<ProjectStatus | 'all', number> = {
      all: projects.length,
      active: 0,
      on_hold: 0,
      completed: 0,
      archived: 0,
    };
    for (const p of projects) {
      c[p.status]++;
    }
    return c;
  }, [projects]);

  const addProject = useCallback((project: Project) => {
    setProjects((prev) => [project, ...prev]);
  }, []);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)),
    );
  }, []);

  return { projects: filtered, grouped, counts, addProject, updateProject };
}
