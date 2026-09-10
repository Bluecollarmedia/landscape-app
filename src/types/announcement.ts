import type { PersonSummary } from './company';

export type AnnouncementAudience = 'all_workers' | 'all_members' | 'selected';
export type AnnouncementPriority = 'normal' | 'urgent';

export interface Announcement {
  id: string;
  companyId: string;
  createdBy: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  priority: AnnouncementPriority;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  author?: PersonSummary;
  readCount?: number;
  totalRecipients?: number;
}

export interface AnnouncementRead {
  id: string;
  announcementId: string;
  personId: string;
  readAt: string;
}
