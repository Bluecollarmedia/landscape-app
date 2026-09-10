import { useMemo } from 'react';
import {
  mockProjects,
  mockAssignments,
  mockMembers,
  mockTrucks,
  mockRequests,
  mockAnnouncements,
} from '@/data/mock';

export interface AttentionItem {
  id: string;
  type: 'worker_not_confirmed' | 'pending_request' | 'project_ending_soon' | 'truck_maintenance';
  title: string;
  subtitle: string;
  icon: string;
  severity: 'warning' | 'info';
}

const today = new Date().toISOString().split('T')[0];

export function useDashboard() {
  const stats = useMemo(() => {
    const activeProjects = mockProjects.filter((p) => p.status === 'active');
    const activeWorkers = mockMembers.filter((m) => m.role === 'worker' && m.status === 'active');
    const todayActive = mockAssignments.filter(
      (a) => a.scheduledDate === today && a.status !== 'cancelled' && a.status !== 'reassigned'
    );
    const confirmed = todayActive.filter((a) => a.confirmationState === 'confirmed').length;
    const availableTrucks = mockTrucks.filter((t) => t.status === 'available' || t.status === 'assigned').length;

    return {
      activeProjectCount: activeProjects.length,
      activeWorkerCount: activeWorkers.length,
      scheduledToday: todayActive.length,
      confirmed,
      truckCount: mockTrucks.length,
      availableTruckCount: availableTrucks,
    };
  }, []);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const todayActive = mockAssignments.filter(
      (a) => a.scheduledDate === today && a.status !== 'cancelled' && a.status !== 'reassigned'
    );

    const notConfirmed = todayActive.filter((a) => a.confirmationState === 'awaiting');
    for (const entry of notConfirmed) {
      const name = entry.person
        ? `${entry.person.firstName} ${entry.person.lastName}`
        : 'Unknown worker';
      items.push({
        id: `confirm_${entry.id}`,
        type: 'worker_not_confirmed',
        title: `${name} hasn't confirmed`,
        subtitle: `Scheduled for ${entry.project?.name ?? 'a project'} at ${entry.startTime ?? 'Full Day'}`,
        icon: 'alert-circle',
        severity: 'warning',
      });
    }

    const pendingRequests = Object.values(mockRequests)
      .flat()
      .filter((r) => r.status === 'pending');
    for (const req of pendingRequests) {
      items.push({
        id: `req_${req.id}`,
        type: 'pending_request',
        title: req.title,
        subtitle: `From ${req.requester?.firstName ?? 'customer'}`,
        icon: 'message-square',
        severity: 'info',
      });
    }

    const maintenanceTrucks = mockTrucks.filter((t) => t.status === 'maintenance');
    for (const truck of maintenanceTrucks) {
      items.push({
        id: `truck_${truck.id}`,
        type: 'truck_maintenance',
        title: `${truck.name} in maintenance`,
        subtitle: truck.notes ?? 'No ETA',
        icon: 'truck',
        severity: 'info',
      });
    }

    return items;
  }, []);

  const todaySchedule = useMemo(() =>
    mockAssignments.filter(
      (a) => a.scheduledDate === today && a.status !== 'cancelled' && a.status !== 'reassigned'
    ),
  []);

  const recentAnnouncements = useMemo(() => mockAnnouncements.slice(0, 2), []);
  const activeProjects = useMemo(() => mockProjects.filter((p) => p.status === 'active'), []);

  return {
    stats,
    attentionItems,
    todaySchedule,
    recentAnnouncements,
    activeProjects,
  };
}
