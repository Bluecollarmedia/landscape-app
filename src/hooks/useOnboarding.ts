import { useState, useCallback, useMemo } from 'react';
import type {
  JoinRequest,
  CompanyInvitation,
  TeamCode,
  CompanyJoinSettings,
  CompanyMembership,
  OnboardingState,
  JoinRequestPerson,
} from '@/types/onboarding';
import {
  mockTeamCode,
  mockDeactivatedCode,
  mockJoinSettings,
  mockJoinRequests,
  mockInvitations,
  mockMemberships,
  mockAuditEvents,
} from '@/data/mockOnboarding';
import { mockMembers, mockPeople } from '@/data/mock';

// ── Team Code Hook ─────────────────────────────────────────────

export function useTeamCode(companyId?: string) {
  const [codes, setCodes] = useState<TeamCode[]>([mockTeamCode, mockDeactivatedCode]);

  const activeCode = useMemo(
    () => codes.find((c) => c.companyId === (companyId ?? 'company1') && c.isActive),
    [codes, companyId],
  );

  const validateCode = useCallback(
    (code: string): { valid: boolean; companyId?: string; companyName?: string } => {
      const found = codes.find((c) => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
      if (found) {
        return { valid: true, companyId: found.companyId, companyName: 'Brighton Lawn + Landscape' };
      }
      return { valid: false };
    },
    [codes],
  );

  const regenerateCode = useCallback(() => {
    const prefix = 'BRIGHTON';
    const num = Math.floor(1000 + Math.random() * 9000);
    const newCode = `${prefix}-${num}`;
    setCodes((prev) =>
      prev.map((c) =>
        c.isActive ? { ...c, isActive: false, deactivatedAt: new Date().toISOString() } : c,
      ).concat({
        id: `tc-${Date.now()}`,
        companyId: companyId ?? 'company1',
        code: newCode,
        isActive: true,
        createdBy: 'owner1',
        createdAt: new Date().toISOString(),
      }),
    );
    return newCode;
  }, [companyId]);

  return { activeCode, validateCode, regenerateCode };
}

// ── Join Requests Hook ─────────────────────────────────────────

export function useJoinRequests(companyId?: string) {
  const [requests, setRequests] = useState<JoinRequest[]>(mockJoinRequests);

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.companyId === (companyId ?? 'company1') && r.status === 'pending'),
    [requests, companyId],
  );

  const allRequests = useMemo(
    () => requests.filter((r) => r.companyId === (companyId ?? 'company1')),
    [requests, companyId],
  );

  const submitRequest = useCallback(
    (personData: JoinRequestPerson, joinMethod: 'team_code' | 'email_invitation', targetCompanyId?: string) => {
      const cId = targetCompanyId ?? companyId ?? 'company1';
      const existing = requests.find(
        (r) => r.companyId === cId && r.personId === personData.id && r.status === 'pending',
      );
      if (existing) return { success: false, reason: 'duplicate' as const };

      const alreadyApproved = requests.find(
        (r) => r.companyId === cId && r.personId === personData.id && r.status === 'approved',
      );
      if (alreadyApproved) return { success: false, reason: 'already_member' as const };

      const newRequest: JoinRequest = {
        id: `jr-${Date.now()}`,
        companyId: cId,
        personId: personData.id,
        joinMethod,
        status: 'pending',
        requestedRole: 'worker',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        person: personData,
      };
      setRequests((prev) => [newRequest, ...prev]);
      return { success: true, requestId: newRequest.id };
    },
    [requests, companyId],
  );

  const approveRequest = useCallback(
    (requestId: string, assignedRole: 'worker' | 'customer' | 'admin') => {
      let approvedPerson: JoinRequestPerson | undefined;
      setRequests((prev) =>
        prev.map((r) => {
          if (r.id === requestId) {
            approvedPerson = r.person;
            return {
              ...r,
              status: 'approved' as const,
              assignedRole,
              reviewedBy: 'owner1',
              reviewedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
          return r;
        }),
      );

      if (approvedPerson) {
        const person = approvedPerson;
        const personSummary: import('@/types/company').PersonSummary = {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          phone: person.phone,
          avatarUrl: person.profilePhotoUrl,
        };
        if (!mockPeople[person.id]) {
          mockPeople[person.id] = personSummary;
        }
        const alreadyMember = mockMembers.some((m) => m.personId === person.id && m.status === 'active');
        if (!alreadyMember) {
          mockMembers.push({
            id: `cm-${Date.now()}`,
            companyId: companyId ?? 'company1',
            personId: person.id,
            role: assignedRole === 'admin' ? 'worker' : assignedRole,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            person: personSummary,
          });
        }
      }
    },
    [companyId],
  );

  const declineRequest = useCallback((requestId: string, reason?: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'declined' as const,
              declineReason: reason,
              reviewedBy: 'owner1',
              reviewedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : r,
      ),
    );
  }, []);

  const cancelRequest = useCallback((requestId: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'cancelled' as const, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
  }, []);

  return { pendingRequests, allRequests, submitRequest, approveRequest, declineRequest, cancelRequest };
}

// ── Invitations Hook ───────────────────────────────────────────

export function useInvitations(companyId?: string) {
  const [invitations, setInvitations] = useState<CompanyInvitation[]>(mockInvitations);

  const pendingInvitations = useMemo(
    () => invitations.filter((i) => i.companyId === (companyId ?? 'company1') && i.status === 'pending'),
    [invitations, companyId],
  );

  const allInvitations = useMemo(
    () => invitations.filter((i) => i.companyId === (companyId ?? 'company1')),
    [invitations, companyId],
  );

  const createInvitation = useCallback(
    (data: { email: string; name?: string; phone?: string; type: 'worker' | 'customer'; projectId?: string }) => {
      const existing = invitations.find(
        (i) => i.email.toLowerCase() === data.email.toLowerCase() && i.status === 'pending',
      );
      if (existing) return { success: false, reason: 'already_invited' as const };

      const token = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);

      const inv: CompanyInvitation = {
        id: `inv-${Date.now()}`,
        companyId: companyId ?? 'company1',
        email: data.email,
        name: data.name,
        phone: data.phone,
        type: data.type,
        status: 'pending',
        projectId: data.projectId,
        invitedBy: 'owner1',
        token,
        expiresAt: expiry.toISOString(),
        createdAt: new Date().toISOString(),
      };
      setInvitations((prev) => [inv, ...prev]);
      return { success: true, invitation: inv };
    },
    [invitations, companyId],
  );

  const revokeInvitation = useCallback((invitationId: string) => {
    setInvitations((prev) =>
      prev.map((i) => (i.id === invitationId ? { ...i, status: 'revoked' as const } : i)),
    );
  }, []);

  const validateInvitationToken = useCallback(
    (token: string) => {
      const inv = invitations.find((i) => i.token === token);
      if (!inv) return { valid: false, reason: 'not_found' as const };
      if (inv.status === 'expired' || new Date(inv.expiresAt) < new Date())
        return { valid: false, reason: 'expired' as const };
      if (inv.status === 'revoked') return { valid: false, reason: 'revoked' as const };
      if (inv.status === 'accepted') return { valid: false, reason: 'already_used' as const };
      return { valid: true, invitation: inv };
    },
    [invitations],
  );

  return { pendingInvitations, allInvitations, createInvitation, revokeInvitation, validateInvitationToken };
}

// ── Join Settings Hook ─────────────────────────────────────────

export function useJoinSettings(companyId?: string) {
  const [settings, setSettings] = useState<CompanyJoinSettings>(mockJoinSettings);

  const updateSettings = useCallback((updates: Partial<CompanyJoinSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  return { settings, updateSettings };
}

// ── Memberships Hook ───────────────────────────────────────────

export function useMemberships(companyId?: string) {
  const [memberships, setMemberships] = useState<CompanyMembership[]>(mockMemberships);

  const activeMemberships = useMemo(
    () => memberships.filter((m) => m.companyId === (companyId ?? 'company1') && m.status === 'active'),
    [memberships, companyId],
  );

  const getMembershipForPerson = useCallback(
    (personId: string) =>
      memberships.find((m) => m.companyId === (companyId ?? 'company1') && m.personId === personId && m.status === 'active'),
    [memberships, companyId],
  );

  const createMembership = useCallback(
    (data: {
      personId: string;
      role: 'worker' | 'customer' | 'admin';
      joinMethod: 'team_code' | 'email_invitation' | 'company_creator';
      joinRequestId?: string;
      person?: JoinRequestPerson;
    }) => {
      const m: CompanyMembership = {
        id: `cm-${Date.now()}`,
        companyId: companyId ?? 'company1',
        personId: data.personId,
        role: data.role,
        status: 'active',
        joinMethod: data.joinMethod,
        joinRequestId: data.joinRequestId,
        approvedBy: 'owner1',
        approvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        person: data.person,
      };
      setMemberships((prev) => [...prev, m]);
      return m;
    },
    [companyId],
  );

  const deactivateMembership = useCallback((personId: string) => {
    setMemberships((prev) =>
      prev.map((m) =>
        m.personId === personId && m.status === 'active'
          ? {
              ...m,
              status: 'inactive' as const,
              deactivatedAt: new Date().toISOString(),
              deactivatedBy: 'owner1',
              updatedAt: new Date().toISOString(),
            }
          : m,
      ),
    );
  }, []);

  return { activeMemberships, getMembershipForPerson, createMembership, deactivateMembership };
}
