import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Announcement, AnnouncementAudience, AnnouncementPriority, AnnouncementRead } from '@/types/announcement';
import type { AppNotification, WeatherActionType } from '@/types/operations';
import { mockAnnouncements, mockAnnouncementReads, mockMembers, mockPeople } from '@/data/mock';
import { mockNotifications } from '@/data/mockOperations';

function activeWorkerIds(): string[] {
  return mockMembers.filter((m) => m.role === 'worker' && m.status === 'active').map((m) => m.personId);
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(mockAnnouncements);
  const [reads, setReads] = useState<AnnouncementRead[]>(mockAnnouncementReads);

  // New Announcement, the Announcements list, and Worker Today are all
  // separate route screens, each with their own copy of this hook's state —
  // re-sync from the shared mock arrays every time a screen regains focus so
  // a send/read made on one screen actually shows up on the others.
  useFocusEffect(
    useCallback(() => {
      setAnnouncements([...mockAnnouncements]);
      setReads([...mockAnnouncementReads]);
    }, []),
  );

  const addAnnouncement = useCallback(
    (data: {
      title: string;
      body: string;
      audience: AnnouncementAudience;
      priority: AnnouncementPriority;
      weatherAction?: WeatherActionType;
    }) => {
      const recipients = activeWorkerIds();
      const newAnn: Announcement = {
        id: `ann_${Date.now()}`,
        companyId: 'company1',
        createdBy: 'owner1',
        title: data.title,
        body: data.body,
        audience: data.audience,
        priority: data.priority,
        weatherAction: data.weatherAction,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: mockPeople.owner1,
        readCount: 0,
        totalRecipients: recipients.length,
      };

      setAnnouncements((prev) => {
        const next = [newAnn, ...prev];
        mockAnnouncements.splice(0, mockAnnouncements.length, ...next);
        return next;
      });

      // Push-notification events, one per active worker. This is the mock
      // stand-in for the real push send — actual remote delivery needs the
      // production backend/push service, so nothing here claims a device
      // actually received anything. It's the same AppNotification model the
      // owner-side Notification Center already reads, just addressed to
      // workers instead of the owner, so it's ready to wire up for real once
      // a push provider exists.
      const isUrgentOrWeather = data.priority === 'urgent' || !!data.weatherAction;
      const pushEvents: AppNotification[] = recipients.map((personId, i) => ({
        id: `notif_ann_${newAnn.id}_${i}`,
        companyId: 'company1',
        recipientId: personId,
        eventType: 'announcement_posted',
        title: isUrgentOrWeather ? `Urgent: ${newAnn.title}` : newAnn.title,
        body: newAnn.body,
        status: 'unread',
        linkedEntityType: 'announcement',
        linkedEntityId: newAnn.id,
        metadata: { priority: newAnn.priority, weatherAction: data.weatherAction },
        createdAt: newAnn.createdAt,
      }));
      mockNotifications.push(...pushEvents);

      return newAnn;
    },
    [],
  );

  const isReadBy = useCallback(
    (announcementId: string, personId: string) => reads.some((r) => r.announcementId === announcementId && r.personId === personId),
    [reads],
  );

  const markAnnouncementRead = useCallback((announcementId: string, personId: string) => {
    setReads((prev) => {
      if (prev.some((r) => r.announcementId === announcementId && r.personId === personId)) return prev;
      const next = [...prev, { id: `ar_${Date.now()}`, announcementId, personId, readAt: new Date().toISOString() }];
      mockAnnouncementReads.splice(0, mockAnnouncementReads.length, ...next);
      return next;
    });
    setAnnouncements((prev) => {
      const next = prev.map((a) =>
        a.id === announcementId ? { ...a, readCount: Math.min((a.readCount ?? 0) + 1, a.totalRecipients ?? a.readCount ?? 0) } : a,
      );
      mockAnnouncements.splice(0, mockAnnouncements.length, ...next);
      return next;
    });
  }, []);

  /** Newest announcement this worker hasn't read yet, or null if fully caught up. */
  const getUnreadForWorker = useCallback(
    (personId: string): Announcement | null => {
      const unread = announcements
        .filter((a) => !isReadBy(a.id, personId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return unread[0] ?? null;
    },
    [announcements, isReadBy],
  );

  return { announcements, addAnnouncement, markAnnouncementRead, isReadBy, getUnreadForWorker };
}
