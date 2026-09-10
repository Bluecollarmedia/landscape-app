import { useState, useMemo, useCallback } from 'react';
import type { CompanyMember, PersonSummary } from '@/types/company';
import type { Assignment } from '@/types/schedule';
import { mockMembers, mockAssignments, mockTrucks, mockProjects } from '@/data/mock';

export type WorkerTodayStatus = 'confirmed' | 'scheduled' | 'not_scheduled' | 'inactive';

export interface WorkerWithStatus {
  member: CompanyMember;
  person: PersonSummary;
  todayStatus: WorkerTodayStatus;
  todayAssignments: Assignment[];
  todayProject?: string;
  todayTruck?: string;
  activeProjectCount: number;
}

interface UseWorkersOptions {
  search?: string;
  statusFilter?: WorkerTodayStatus | 'all';
  includeInactive?: boolean;
}

const today = new Date().toISOString().split('T')[0];

export function useWorkers(options: UseWorkersOptions = {}) {
  const { search = '', statusFilter = 'all', includeInactive = false } = options;
  const [members, setMembers] = useState<CompanyMember[]>(() => mockMembers);
  const [, forceUpdate] = useState(0);

  const refreshMembers = useCallback(() => {
    setMembers([...mockMembers]);
    forceUpdate((n) => n + 1);
  }, []);

  const workers = useMemo<WorkerWithStatus[]>(() => {
    const workerMembers = members.filter(
      (m) => m.role === 'worker' && (includeInactive || m.status !== 'inactive'),
    );

    return workerMembers.map((m) => {
      const person = m.person!;
      const todayAssignments = mockAssignments.filter(
        (a) => a.personId === m.personId && a.scheduledDate === today &&
               a.status !== 'cancelled' && a.status !== 'reassigned'
      );
      const truck = mockTrucks.find((t) => t.assignedTo === m.personId);

      const activeProjects = mockProjects.filter(
        (p) => p.status === 'active',
      ).length;

      let todayStatus: WorkerTodayStatus;
      if (m.status === 'inactive') {
        todayStatus = 'inactive';
      } else if (todayAssignments.some(a => a.confirmationState === 'confirmed')) {
        todayStatus = 'confirmed';
      } else if (todayAssignments.length > 0) {
        todayStatus = 'scheduled';
      } else {
        todayStatus = 'not_scheduled';
      }

      return {
        member: m,
        person,
        todayStatus,
        todayAssignments,
        todayProject: todayAssignments[0]?.project?.name,
        todayTruck: truck?.name,
        activeProjectCount: activeProjects,
      };
    });
  }, [members, includeInactive]);

  const filtered = useMemo(() => {
    let result = workers;

    if (statusFilter !== 'all') {
      result = result.filter((w) => w.todayStatus === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (w) =>
          w.person.firstName.toLowerCase().includes(q) ||
          w.person.lastName.toLowerCase().includes(q) ||
          w.person.email.toLowerCase().includes(q) ||
          w.person.phone?.includes(q),
      );
    }

    return result;
  }, [workers, search, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: workers.length, confirmed: 0, scheduled: 0, not_scheduled: 0, inactive: 0 };
    for (const w of workers) {
      c[w.todayStatus]++;
    }
    return c;
  }, [workers]);

  const addWorker = useCallback((person: PersonSummary) => {
    const newMember: CompanyMember = {
      id: `cm_${Date.now()}`,
      companyId: 'company1',
      personId: person.id,
      role: 'worker',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      person,
    };
    setMembers((prev) => [...prev, newMember]);
  }, []);

  const updateWorker = useCallback((personId: string, updates: Partial<CompanyMember>) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.personId === personId ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m,
      ),
    );
  }, []);

  const getWorker = useCallback(
    (personId: string) => workers.find((w) => w.person.id === personId),
    [workers],
  );

  return { workers: filtered, allWorkers: workers, counts, addWorker, updateWorker, getWorker, refreshMembers };
}
