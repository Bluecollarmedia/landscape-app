import { useState, useCallback } from 'react';
import type { Announcement, AnnouncementAudience, AnnouncementPriority } from '@/types/announcement';
import { mockAnnouncements, mockPeople } from '@/data/mock';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(mockAnnouncements);

  const addAnnouncement = useCallback(
    (data: { title: string; body: string; audience: AnnouncementAudience; priority: AnnouncementPriority }) => {
      const newAnn: Announcement = {
        id: `ann_${Date.now()}`,
        companyId: 'company1',
        createdBy: 'owner1',
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: mockPeople.owner1,
        readCount: 0,
        totalRecipients: 4,
      };
      setAnnouncements((prev) => [newAnn, ...prev]);
    },
    [],
  );

  return { announcements, addAnnouncement };
}
