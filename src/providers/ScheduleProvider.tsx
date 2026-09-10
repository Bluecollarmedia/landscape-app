import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Assignment, ScheduleChange, ScheduleChangeType, ScheduleConflict, TravelWarning } from '@/types/schedule';
import { mockAssignments, mockScheduleChanges, mockPeople, mockProjects, mockTrucks } from '@/data/mock';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timesOverlap(s1?: string, e1?: string, s2?: string, e2?: string): boolean {
  if (!s1 || !e1 || !s2 || !e2) return false;
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(s2) < timeToMinutes(e1);
}

function isActive(a: Assignment): boolean {
  return a.status !== 'cancelled' && a.status !== 'reassigned';
}

const today = new Date().toISOString().split('T')[0];

export interface ScheduleContextValue {
  assignments: Assignment[];
  changes: ScheduleChange[];
  stats: { total: number; confirmed: number; awaiting: number };
  getByDate: (date: string) => Assignment[];
  getAllByDate: (date: string) => Assignment[];
  getByWorker: (personId: string, date?: string) => Assignment[];
  getByProject: (projectId: string, date?: string) => Assignment[];
  getGroupedByWorker: (date: string) => Record<string, { person: Assignment['person']; truck?: Assignment['truck']; assignments: Assignment[] }>;
  weekSummary: (startDate: string) => { date: string; label: string; workerCount: number; projectCount: number; hasIssues: boolean }[];
  detectConflicts: (params: {
    personId: string; scheduledDate: string; startTime?: string; endTime?: string;
    isFullDay: boolean; truckId?: string; excludeId?: string;
  }) => ScheduleConflict[];
  detectTravelWarnings: (personId: string, date: string) => TravelWarning[];
  createAssignment: (params: {
    personId: string; projectId: string; scheduledDate: string;
    startTime?: string; endTime?: string; isFullDay: boolean;
    truckId?: string; notes?: string;
  }) => Assignment;
  cancelAssignment: (assignmentId: string, reason?: string) => void;
  moveWorker: (assignmentId: string, newProjectId: string, notes?: string) => Assignment | undefined;
  updateAssignment: (assignmentId: string, updates: Partial<Pick<Assignment, 'startTime' | 'endTime' | 'isFullDay' | 'truckId' | 'notes'>>, changeNotes?: string) => void;
  getChangesForAssignment: (assignmentId: string) => ScheduleChange[];
  getChangesForDate: (date: string) => ScheduleChange[];
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [assignments, setAssignments] = useState<Assignment[]>(mockAssignments);
  const [changes, setChanges] = useState<ScheduleChange[]>(mockScheduleChanges);

  const getByDate = useCallback((date: string) => {
    return assignments.filter(a => a.scheduledDate === date && isActive(a));
  }, [assignments]);

  const getAllByDate = useCallback((date: string) => {
    return assignments.filter(a => a.scheduledDate === date);
  }, [assignments]);

  const getByWorker = useCallback((personId: string, date?: string) => {
    return assignments.filter(a => {
      if (a.personId !== personId) return false;
      if (date && a.scheduledDate !== date) return false;
      return isActive(a);
    });
  }, [assignments]);

  const getByProject = useCallback((projectId: string, date?: string) => {
    return assignments.filter(a => {
      if (a.projectId !== projectId) return false;
      if (date && a.scheduledDate !== date) return false;
      return isActive(a);
    });
  }, [assignments]);

  const getGroupedByWorker = useCallback((date: string) => {
    const active = assignments.filter(a => a.scheduledDate === date && isActive(a));
    const grouped: Record<string, { person: Assignment['person']; truck?: Assignment['truck']; assignments: Assignment[] }> = {};

    for (const a of active) {
      if (!a.person) continue;
      if (!grouped[a.personId]) {
        grouped[a.personId] = { person: a.person, assignments: [] };
      }
      grouped[a.personId].assignments.push(a);
      if (a.truck) grouped[a.personId].truck = a.truck;
    }

    for (const key of Object.keys(grouped)) {
      grouped[key].assignments.sort((a, b) => {
        if (a.isFullDay) return -1;
        if (b.isFullDay) return 1;
        return (a.startTime ?? '').localeCompare(b.startTime ?? '');
      });
    }
    return grouped;
  }, [assignments]);

  const detectConflicts = useCallback((params: {
    personId: string; scheduledDate: string; startTime?: string; endTime?: string;
    isFullDay: boolean; truckId?: string; excludeId?: string;
  }): ScheduleConflict[] => {
    const conflicts: ScheduleConflict[] = [];
    const active = assignments.filter(a =>
      a.scheduledDate === params.scheduledDate && isActive(a) && a.id !== params.excludeId
    );

    const workerAssignments = active.filter(a => a.personId === params.personId);
    for (const existing of workerAssignments) {
      if (params.isFullDay || existing.isFullDay ||
          timesOverlap(params.startTime, params.endTime, existing.startTime, existing.endTime)) {
        const timeStr = existing.isFullDay ? 'Full Day' : `${existing.startTime}–${existing.endTime}`;
        conflicts.push({
          type: 'time_overlap',
          assignment: existing,
          message: `${existing.person?.firstName} is already scheduled at ${existing.project?.name} (${timeStr})`,
        });
      }
    }

    if (params.truckId) {
      const truckAssignments = active.filter(a => a.truckId === params.truckId && a.personId !== params.personId);
      for (const existing of truckAssignments) {
        if (params.isFullDay || existing.isFullDay ||
            timesOverlap(params.startTime, params.endTime, existing.startTime, existing.endTime)) {
          const timeStr = existing.isFullDay ? 'Full Day' : `${existing.startTime}–${existing.endTime}`;
          conflicts.push({
            type: 'truck_overlap',
            assignment: existing,
            message: `${existing.truck?.name} is assigned to ${existing.person?.firstName} ${existing.person?.lastName} (${timeStr})`,
          });
        }
      }
    }

    return conflicts;
  }, [assignments]);

  const detectTravelWarnings = useCallback((personId: string, date: string): TravelWarning[] => {
    const dayAssignments = assignments
      .filter(a => a.personId === personId && a.scheduledDate === date && !a.isFullDay && isActive(a))
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

    const warnings: TravelWarning[] = [];
    for (let i = 0; i < dayAssignments.length - 1; i++) {
      const current = dayAssignments[i];
      const next = dayAssignments[i + 1];
      if (current.endTime && next.startTime) {
        const gap = timeToMinutes(next.startTime) - timeToMinutes(current.endTime);
        if (gap >= 0 && gap < 30) {
          warnings.push({ fromAssignment: current, toAssignment: next, availableMinutes: gap });
        }
      }
    }
    return warnings;
  }, [assignments]);

  const addChange = useCallback((change: Omit<ScheduleChange, 'id' | 'createdAt'>) => {
    const full: ScheduleChange = {
      ...change,
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setChanges(prev => [full, ...prev]);
    return full;
  }, []);

  const createAssignment = useCallback((params: {
    personId: string; projectId: string; scheduledDate: string;
    startTime?: string; endTime?: string; isFullDay: boolean;
    truckId?: string; notes?: string;
  }): Assignment => {
    const person = mockPeople[params.personId];
    const project = mockProjects.find(pr => pr.id === params.projectId);
    const truck = params.truckId ? mockTrucks.find(t => t.id === params.truckId) : undefined;

    const dayCount = assignments.filter(a =>
      a.personId === params.personId && a.scheduledDate === params.scheduledDate && isActive(a)
    ).length;

    const newAssignment: Assignment = {
      id: `a_${Date.now()}`,
      companyId: 'company1',
      projectId: params.projectId,
      personId: params.personId,
      scheduledDate: params.scheduledDate,
      startTime: params.isFullDay ? undefined : params.startTime,
      endTime: params.isFullDay ? undefined : params.endTime,
      isFullDay: params.isFullDay,
      sortOrder: dayCount + 1,
      status: 'scheduled',
      confirmationState: 'not_sent',
      truckId: params.truckId,
      notes: params.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      person: person ? { ...person } : undefined,
      project: project ? { id: project.id, name: project.name, address: project.address } : undefined,
      truck: truck ? { id: truck.id, name: truck.name } : undefined,
    };

    setAssignments(prev => [...prev, newAssignment]);

    const timeStr = params.isFullDay ? 'Full Day' : `${params.startTime}–${params.endTime}`;
    addChange({
      assignmentId: newAssignment.id,
      companyId: 'company1',
      changedBy: 'owner1',
      changeType: 'created',
      newValue: JSON.stringify({ project: project?.name, time: timeStr, worker: person ? `${person.firstName} ${person.lastName}` : '' }),
      changer: mockPeople.owner1,
    });

    return newAssignment;
  }, [assignments, addChange]);

  const cancelAssignment = useCallback((assignmentId: string, reason?: string) => {
    const original = assignments.find(a => a.id === assignmentId);
    if (!original) return;

    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      return {
        ...a,
        status: 'cancelled' as const,
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'owner1',
        cancellationReason: reason,
        updatedAt: new Date().toISOString(),
      };
    }));

    addChange({
      assignmentId,
      companyId: 'company1',
      changedBy: 'owner1',
      changeType: 'cancelled',
      previousValue: JSON.stringify({
        project: original.project?.name,
        time: original.isFullDay ? 'Full Day' : `${original.startTime}–${original.endTime}`,
      }),
      notes: reason,
      changer: mockPeople.owner1,
    });
  }, [assignments, addChange]);

  const moveWorker = useCallback((assignmentId: string, newProjectId: string, notes?: string): Assignment | undefined => {
    const original = assignments.find(a => a.id === assignmentId);
    if (!original) return undefined;

    const project = mockProjects.find(pr => pr.id === newProjectId);
    const now = new Date().toISOString();
    const newId = `a_${Date.now()}`;

    const newAssignment: Assignment = {
      ...original,
      id: newId,
      projectId: newProjectId,
      status: 'scheduled',
      confirmationState: original.confirmationState === 'confirmed' ? 'updated_since' as const : original.confirmationState,
      reassignedFrom: assignmentId,
      project: project ? { id: project.id, name: project.name, address: project.address } : undefined,
      notes: notes || original.notes,
      createdAt: now,
      updatedAt: now,
    };

    setAssignments(prev => [
      ...prev.map(a => {
        if (a.id !== assignmentId) return a;
        return { ...a, status: 'reassigned' as const, reassignedTo: newId, updatedAt: now };
      }),
      newAssignment,
    ]);

    addChange({
      assignmentId,
      companyId: 'company1',
      changedBy: 'owner1',
      changeType: 'reassigned',
      previousValue: JSON.stringify({ project: original.project?.name }),
      newValue: JSON.stringify({ project: project?.name }),
      notes: notes || `Moved to ${project?.name}`,
      changer: mockPeople.owner1,
    });

    addChange({
      assignmentId: newId,
      companyId: 'company1',
      changedBy: 'owner1',
      changeType: 'emergency_override',
      newValue: JSON.stringify({ project: project?.name, movedFrom: original.project?.name }),
      notes,
      changer: mockPeople.owner1,
    });

    return newAssignment;
  }, [assignments, addChange]);

  const updateAssignment = useCallback((assignmentId: string, updates: Partial<Pick<Assignment, 'startTime' | 'endTime' | 'isFullDay' | 'truckId' | 'notes'>>, changeNotes?: string) => {
    const original = assignments.find(a => a.id === assignmentId);
    if (!original) return;

    const wasConfirmed = original.confirmationState === 'confirmed';

    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      const truck = updates.truckId ? mockTrucks.find(t => t.id === updates.truckId) : (updates.truckId === undefined ? a.truck : undefined);
      return {
        ...a,
        ...updates,
        truck: truck ? { id: truck.id, name: truck.name } : undefined,
        confirmationState: wasConfirmed ? 'updated_since' as const : a.confirmationState,
        updatedAt: new Date().toISOString(),
      };
    }));

    let changeType: ScheduleChangeType = 'time_changed';
    if (updates.truckId !== undefined) changeType = 'truck_changed';
    else if (updates.notes !== undefined && updates.startTime === undefined) changeType = 'notes_changed';

    addChange({
      assignmentId,
      companyId: 'company1',
      changedBy: 'owner1',
      changeType,
      previousValue: JSON.stringify({
        startTime: original.startTime, endTime: original.endTime,
        isFullDay: original.isFullDay, truck: original.truck?.name,
      }),
      newValue: JSON.stringify({
        startTime: updates.startTime ?? original.startTime,
        endTime: updates.endTime ?? original.endTime,
        isFullDay: updates.isFullDay ?? original.isFullDay,
        truck: updates.truckId ? mockTrucks.find(t => t.id === updates.truckId)?.name : original.truck?.name,
      }),
      notes: changeNotes,
      changer: mockPeople.owner1,
    });
  }, [assignments, addChange]);

  const getChangesForAssignment = useCallback((assignmentId: string) => {
    return changes.filter(c => c.assignmentId === assignmentId);
  }, [changes]);

  const getChangesForDate = useCallback((date: string) => {
    const dayAssignmentIds = new Set(
      assignments.filter(a => a.scheduledDate === date).map(a => a.id)
    );
    return changes.filter(c => dayAssignmentIds.has(c.assignmentId));
  }, [assignments, changes]);

  const weekSummary = useCallback((startDate: string) => {
    const start = new Date(startDate + 'T00:00:00');
    const days: { date: string; label: string; workerCount: number; projectCount: number; hasIssues: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayAssignments = assignments.filter(a => a.scheduledDate === dateStr && isActive(a));
      const workers = new Set(dayAssignments.map(a => a.personId));
      const projects = new Set(dayAssignments.map(a => a.projectId));
      const hasUnconfirmed = dayAssignments.some(a => a.confirmationState === 'awaiting');
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        workerCount: workers.size,
        projectCount: projects.size,
        hasIssues: hasUnconfirmed,
      });
    }
    return days;
  }, [assignments]);

  const todayAssignments = useMemo(() => getByDate(today), [getByDate]);

  const stats = useMemo(() => {
    const active = todayAssignments;
    const confirmed = active.filter(a => a.confirmationState === 'confirmed').length;
    const awaiting = active.filter(a => a.confirmationState === 'awaiting').length;
    return { total: active.length, confirmed, awaiting };
  }, [todayAssignments]);

  const value: ScheduleContextValue = useMemo(() => ({
    assignments, changes, stats,
    getByDate, getAllByDate, getByWorker, getByProject,
    getGroupedByWorker, weekSummary,
    detectConflicts, detectTravelWarnings,
    createAssignment, cancelAssignment, moveWorker, updateAssignment,
    getChangesForAssignment, getChangesForDate,
  }), [
    assignments, changes, stats,
    getByDate, getAllByDate, getByWorker, getByProject,
    getGroupedByWorker, weekSummary,
    detectConflicts, detectTravelWarnings,
    createAssignment, cancelAssignment, moveWorker, updateAssignment,
    getChangesForAssignment, getChangesForDate,
  ]);

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleContext(): ScheduleContextValue {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useScheduleContext must be used within ScheduleProvider');
  return ctx;
}
