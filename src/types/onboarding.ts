import type { WorkerType } from './maintenance';

// ── Join Request ────────────────────────────────────────────────

export type JoinMethod = 'team_code' | 'email_invitation' | 'invitation_link';
export type JoinRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface JoinRequest {
  id: string;
  companyId: string;
  personId: string;
  joinMethod: JoinMethod;
  invitationId?: string;
  status: JoinRequestStatus;
  requestedRole?: 'worker' | 'customer';
  assignedRole?: 'worker' | 'customer' | 'admin';
  /** Which kind of team code they used. Only a label: the owner still approves. */
  requestedWorkerType?: WorkerType;
  /** The type the owner approved them as. */
  assignedWorkerType?: WorkerType;
  reviewedBy?: string;
  reviewedAt?: string;
  declineReason?: string;
  createdAt: string;
  updatedAt: string;
  person?: JoinRequestPerson;
}

export interface JoinRequestPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profilePhotoUrl?: string;
}

// ── Company Invitation ─────────────────────────────────────────

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type InvitationType = 'worker' | 'customer';

export interface CompanyInvitation {
  id: string;
  companyId: string;
  email: string;
  name?: string;
  phone?: string;
  type: InvitationType;
  status: InvitationStatus;
  projectId?: string;
  invitedBy: string;
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  createdAt: string;
}

// ── Team Code ──────────────────────────────────────────────────

export interface TeamCode {
  id: string;
  companyId: string;
  code: string;
  /** A maintenance code marks the join request as maintenance. Missing means 'landscaping'. */
  workerType?: WorkerType;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  deactivatedAt?: string;
}

// ── Company Join Settings ──────────────────────────────────────

export interface CompanyJoinSettings {
  companyId: string;
  joinByCodeEnabled: boolean;
  directInvitationsEnabled: boolean;
  requireEmailVerification: boolean;
  currentTeamCodeId?: string;
}

// ── Membership Audit ───────────────────────────────────────────

export type MembershipAuditEventType =
  | 'company_created'
  | 'invitation_created'
  | 'invitation_revoked'
  | 'join_request_submitted'
  | 'join_request_approved'
  | 'join_request_declined'
  | 'join_request_cancelled'
  | 'team_code_generated'
  | 'team_code_deactivated'
  | 'join_by_code_enabled'
  | 'join_by_code_disabled'
  | 'worker_activated'
  | 'worker_deactivated'
  | 'customer_approved'
  | 'role_changed'
  | 'worker_type_changed'
  | 'ownership_transferred';

export interface MembershipAuditEvent {
  id: string;
  companyId: string;
  eventType: MembershipAuditEventType;
  actorId: string;
  targetId?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

// ── Onboarding State ───────────────────────────────────────────

export type OnboardingStep =
  | 'welcome'
  | 'sign_in'
  | 'create_company'
  | 'join_team_code'
  | 'join_invitation'
  | 'complete_profile'
  | 'pending_approval'
  | 'declined'
  | 'ready';

export interface OnboardingState {
  step: OnboardingStep;
  companyId?: string;
  companyName?: string;
  joinRequestId?: string;
  invitationId?: string;
}

// ── Extended Person (with profile photo) ───────────────────────

export interface PersonProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePhotoUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Company Membership (clean separation) ──────────────────────

export type CompanyMembershipRole = 'owner' | 'admin' | 'worker' | 'customer';
export type CompanyMembershipStatus = 'active' | 'inactive' | 'suspended';

export interface CompanyMembership {
  id: string;
  companyId: string;
  personId: string;
  role: CompanyMembershipRole;
  status: CompanyMembershipStatus;
  joinMethod: JoinMethod | 'company_creator';
  joinRequestId?: string;
  approvedBy?: string;
  approvedAt?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  createdAt: string;
  updatedAt: string;
  person?: JoinRequestPerson;
}
