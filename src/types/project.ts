import type { PersonSummary } from './company';

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type PhotoType = 'progress' | 'before' | 'after' | 'issue' | 'general';
export type RequestStatus = 'pending' | 'acknowledged' | 'completed' | 'declined' | 'converted';
export type RequestCategory = 'change_request' | 'question' | 'additional_work' | 'other';
export type HistoryEventType =
  | 'project_created'
  | 'status_changed'
  | 'progress_updated'
  | 'team_member_added'
  | 'team_member_removed'
  | 'task_created'
  | 'task_completed'
  | 'photo_added'
  | 'update_posted'
  | 'request_created'
  | 'request_responded'
  | 'settings_changed'
  | 'note_added';

export interface Project {
  id: string;
  companyId: string;
  customerId?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  status: ProjectStatus;
  progress: number;
  startDate?: string;
  estimatedEndDate?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  customer?: PersonSummary;
  teamCount?: number;
  taskCount?: number;
  openTaskCount?: number;
  customerProjectCode?: string;
  customerClaimedBy?: string;
  customerClaimedAt?: string;
}

export interface CustomerProjectAccess {
  projectId: string;
  projectName: string;
  code: string;
  portalEnabled: boolean;
  claimedBy?: string;
  claimedByEmail?: string;
  claimedAt?: string;
}

export interface ProjectTeamMember {
  id: string;
  projectId: string;
  personId: string;
  addedAt: string;
  removedAt?: string;
  person?: PersonSummary;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  sortOrder: number;
  assignedTo?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  assignee?: PersonSummary;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  customerInteractionEnabled: boolean;
  completionPhotoRequired: boolean;
  checkinRadiusMeters?: number;
  customerCanRequest: boolean;
  customerCanViewPhotos: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPhoto {
  id: string;
  projectId: string;
  taskId?: string;
  assignmentId?: string;
  uploadedBy: string;
  fileKey: string;
  fileUrl: string;
  caption?: string;
  customerDescription?: string;
  isCustomerVisible: boolean;
  sharedBy?: string;
  sharedAt?: string;
  photoType: PhotoType;
  takenAt: string;
  createdAt: string;
  uploader?: PersonSummary;
  sharer?: PersonSummary;
  taskTitle?: string;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  createdBy: string;
  title: string;
  body: string;
  isCustomerVisible: boolean;
  photoIds?: string[];
  createdAt: string;
  updatedAt: string;
  author?: PersonSummary;
}

export interface ProjectRequest {
  id: string;
  projectId: string;
  requestedBy: string;
  title: string;
  description?: string;
  category: RequestCategory;
  attachmentUrl?: string;
  status: RequestStatus;
  linkedTaskId?: string;
  respondedAt?: string;
  responseNote?: string;
  createdAt: string;
  updatedAt: string;
  requester?: PersonSummary;
}

export type CustomerTimelineType =
  | 'update_shared'
  | 'photo_shared'
  | 'progress_updated'
  | 'project_started'
  | 'project_completed'
  | 'request_responded';

export interface CustomerTimelineEvent {
  id: string;
  projectId: string;
  eventType: CustomerTimelineType;
  title: string;
  description?: string;
  photoUrl?: string;
  timestamp: string;
}

export interface ProjectHistoryEntry {
  id: string;
  projectId: string;
  actorId?: string;
  eventType: HistoryEventType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  actor?: PersonSummary;
}

