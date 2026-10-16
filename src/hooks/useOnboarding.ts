import { useCallback, useMemo } from 'react';
import type {
  JoinRequest,
  CompanyInvitation,
  TeamCode,
  CompanyJoinSettings,
  CompanyMembership,
  JoinRequestPerson,
} from '@/types/onboarding';
import type { WorkerType } from '@/types/maintenance';
import { db, useDb, insertRow, updateRow, upsertRow, rpc, refresh, isDemo } from '@/data/store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { placeInMaintenanceCrew } from '@/data/maintenance';

function randomSuffix(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function codePrefix(): string {
  const letters = (db.company?.name ?? 'TEAM').replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters + 'TEAM').slice(0, 8);
}

// ── Team Code Hook ─────────────────────────────────────────────

const typeOf = (c: TeamCode): WorkerType => c.workerType ?? 'landscaping';

/** The team code for one kind of worker. Regular and maintenance codes are
 * separate; either one only files a request that the owner must approve. */
export function useTeamCode(companyId?: string, workerType: WorkerType = 'landscaping') {
  const v = useDb();

  const activeCode = useMemo<TeamCode | undefined>(
    () => db.teamCodes.filter((c) => c.companyId === (companyId ?? db.companyId) && c.isActive && typeOf(c) === workerType).pop(),
    [v, companyId, workerType],
  );

  /** Checks a team code before joining. Works before sign-in. */
  const validateCode = useCallback(
    async (code: string): Promise<{ valid: boolean; companyId?: string; companyName?: string; workerType?: WorkerType }> => {
      if (!isSupabaseConfigured) {
        const found = db.teamCodes.find((c) => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
        return found ? { valid: true, companyId: found.companyId, companyName: db.company?.name ?? 'Brighton Lawn + Landscape', workerType: typeOf(found) } : { valid: false };
      }
      const { data, error } = await supabase.rpc('lookup_team_code', { p_code: code });
      if (error || !data) return { valid: false };
      const r = data as { valid: boolean; company_id?: string; company_name?: string; worker_type?: WorkerType };
      return { valid: !!r.valid, companyId: r.company_id, companyName: r.company_name, workerType: r.worker_type ?? 'landscaping' };
    },
    [],
  );

  /** Replaces this kind's code (the other kind keeps working). Also creates
   * the maintenance code the first time. */
  const regenerateCode = useCallback(() => {
    const now = new Date().toISOString();
    for (const c of db.teamCodes.filter((t) => t.isActive && typeOf(t) === workerType)) {
      updateRow('team_codes', c.id, { isActive: false, deactivatedAt: now });
    }
    const newCode = workerType === 'maintenance'
      ? `${codePrefix()}-MAINT-${randomSuffix()}`
      : `${codePrefix()}-${randomSuffix()}`;
    const row = insertRow('team_codes', {
      code: newCode,
      // Only sent for maintenance, so regular codes save even before update 019.
      ...(workerType === 'maintenance' ? { workerType } : {}),
      isActive: true,
      createdBy: db.personId,
    });
    if (workerType === 'landscaping') {
      upsertRow('company_join_settings', { ...db.joinSettings, companyId: db.companyId, currentTeamCodeId: row.id });
    }
    insertRow('membership_audit_log', { eventType: 'team_code_generated', actorId: db.personId, metadata: { workerType } });
    return newCode;
  }, [workerType]);

  return { activeCode, validateCode, regenerateCode };
}

// ── Join Requests Hook ─────────────────────────────────────────

export function useJoinRequests(companyId?: string) {
  const v = useDb();
  const cid = companyId ?? db.companyId;

  const pendingRequests = useMemo<JoinRequest[]>(
    () => db.joinRequests.filter((r) => r.companyId === cid && r.status === 'pending'),
    [v, cid],
  );

  const allRequests = useMemo<JoinRequest[]>(
    () => db.joinRequests.filter((r) => r.companyId === cid),
    [v, cid],
  );

  const submitRequest = useCallback(
    (personData: JoinRequestPerson, joinMethod: 'team_code' | 'email_invitation', targetCompanyId?: string) => {
      const target = targetCompanyId ?? cid;
      const existing = db.joinRequests.find((r) => r.companyId === target && r.personId === personData.id && r.status === 'pending');
      if (existing) return { success: false, reason: 'duplicate' as const };
      const row = insertRow('join_requests', {
        companyId: target,
        personId: personData.id,
        joinMethod,
        status: 'pending',
        requestedRole: 'worker',
      });
      return { success: true, requestId: row.id as string };
    },
    [cid],
  );

  /** Approves a request and makes the person an active member with this role.
   * `workerType` is the owner's choice; it defaults to what they applied as. */
  const approveRequest = useCallback(
    async (requestId: string, assignedRole: 'worker' | 'customer' | 'admin', workerType?: WorkerType) => {
      const request = db.joinRequests.find((r) => r.id === requestId);
      if (!request) return;
      const wtype: WorkerType = assignedRole === 'worker' ? (workerType ?? request.requestedWorkerType ?? 'landscaping') : 'landscaping';
      if (isDemo()) {
        updateRow('join_requests', requestId, {
          status: 'approved', assignedRole, assignedWorkerType: wtype, reviewedBy: db.personId, reviewedAt: new Date().toISOString(),
        });
        const existing = db.members.find((m) => m.personId === request.personId);
        if (existing) updateRow('company_members', existing.id, { role: assignedRole, status: 'active', workerType: wtype });
        else insertRow('company_members', { personId: request.personId, role: assignedRole, status: 'active', workerType: wtype, joinMethod: request.joinMethod, joinRequestId: requestId });
        placeInMaintenanceCrew(request.personId, wtype);
        return;
      }
      // Optimistic: hide it from the pending list right away.
      updateRow('join_requests', requestId, { status: 'approved', assignedRole, assignedWorkerType: wtype });
      // The database also puts maintenance workers in the Maintenance Crew (update 019).
      const { error } = await rpc('approve_join_request', { p_request_id: requestId, p_role: assignedRole, p_worker_type: wtype });
      if (error) console.warn('[join] approve failed', error.message);
      await refresh('join_requests', 'company_members', 'people', 'crew_members');
    },
    [],
  );

  const declineRequest = useCallback(async (requestId: string, reason?: string) => {
    if (isDemo()) {
      updateRow('join_requests', requestId, {
        status: 'declined', declineReason: reason, reviewedBy: db.personId, reviewedAt: new Date().toISOString(),
      });
      return;
    }
    updateRow('join_requests', requestId, { status: 'declined', declineReason: reason });
    const { error } = await rpc('decline_join_request', { p_request_id: requestId, p_reason: reason ?? null });
    if (error) console.warn('[join] decline failed', error.message);
    await refresh('join_requests');
  }, []);

  const cancelRequest = useCallback((requestId: string) => {
    updateRow('join_requests', requestId, { status: 'cancelled' });
  }, []);

  return { pendingRequests, allRequests, submitRequest, approveRequest, declineRequest, cancelRequest };
}

// ── Invitations Hook ───────────────────────────────────────────

export function useInvitations(companyId?: string) {
  const v = useDb();
  const cid = companyId ?? db.companyId;

  const pendingInvitations = useMemo<CompanyInvitation[]>(
    () => db.invitations.filter((i) => i.companyId === cid && i.status === 'pending'),
    [v, cid],
  );

  const allInvitations = useMemo<CompanyInvitation[]>(
    () => db.invitations.filter((i) => i.companyId === cid),
    [v, cid],
  );

  /** Records an invitation. Whoever creates an account with this email is
   * added to the company automatically (no approval needed). No email is
   * sent by the app — share the app with them yourself. */
  const createInvitation = useCallback(
    (data: { email: string; name?: string; phone?: string; type: 'worker' | 'customer'; projectId?: string }) => {
      const existing = db.invitations.find(
        (i) => i.email.toLowerCase() === data.email.toLowerCase() && i.status === 'pending',
      );
      if (existing) return { success: false, reason: 'already_invited' as const };

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 14);
      const inv = insertRow('company_invitations', {
        email: data.email.trim().toLowerCase(),
        name: data.name,
        phone: data.phone,
        type: data.type,
        status: 'pending',
        projectId: data.projectId,
        invitedBy: db.personId,
        token: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
        expiresAt: expiry.toISOString(),
      }) as unknown as CompanyInvitation;
      insertRow('membership_audit_log', { eventType: 'invitation_created', actorId: db.personId, metadata: { email: data.email } });
      return { success: true, invitation: inv };
    },
    [],
  );

  const revokeInvitation = useCallback((invitationId: string) => {
    updateRow('company_invitations', invitationId, { status: 'revoked' });
  }, []);

  const validateInvitationToken = useCallback(
    (token: string) => {
      const inv = db.invitations.find((i) => i.token === token);
      if (!inv) return { valid: false, reason: 'not_found' as const };
      if (inv.status === 'expired' || new Date(inv.expiresAt) < new Date())
        return { valid: false, reason: 'expired' as const };
      if (inv.status === 'revoked') return { valid: false, reason: 'revoked' as const };
      if (inv.status === 'accepted') return { valid: false, reason: 'already_used' as const };
      return { valid: true, invitation: inv };
    },
    [v],
  );

  return { pendingInvitations, allInvitations, createInvitation, revokeInvitation, validateInvitationToken };
}

// ── Join Settings Hook ─────────────────────────────────────────

export function useJoinSettings(companyId?: string) {
  const v = useDb();
  const settings = useMemo<CompanyJoinSettings>(() => ({ ...db.joinSettings }), [v]);

  const updateSettings = useCallback((updates: Partial<CompanyJoinSettings>) => {
    upsertRow('company_join_settings', { ...db.joinSettings, ...updates, companyId: companyId ?? db.companyId });
  }, [companyId]);

  return { settings, updateSettings };
}

// ── Memberships Hook ───────────────────────────────────────────

export function useMemberships(companyId?: string) {
  const v = useDb();
  const cid = companyId ?? db.companyId;

  const activeMemberships = useMemo<CompanyMembership[]>(
    () => db.memberships.filter((m) => m.companyId === cid && m.status === 'active'),
    [v, cid],
  );

  const getMembershipForPerson = useCallback(
    (personId: string) => db.memberships.find((m) => m.companyId === cid && m.personId === personId && m.status === 'active'),
    [v, cid],
  );

  /** Membership is created by the database when a join request is approved
   * (approve_join_request). This only fills the gap in demo mode or when a
   * membership is genuinely missing. */
  const createMembership = useCallback(
    (data: {
      personId: string;
      role: 'worker' | 'customer' | 'admin';
      joinMethod: 'team_code' | 'email_invitation' | 'company_creator';
      joinRequestId?: string;
      person?: JoinRequestPerson;
    }) => {
      const existing = db.members.find((m) => m.companyId === cid && m.personId === data.personId);
      if (existing) {
        return db.memberships.find((m) => m.id === existing.id)!;
      }
      const row = insertRow('company_members', {
        personId: data.personId,
        role: data.role,
        status: 'active',
        joinMethod: data.joinMethod,
        joinRequestId: data.joinRequestId,
        approvedBy: db.personId,
        approvedAt: new Date().toISOString(),
      });
      return { ...row, person: data.person } as unknown as CompanyMembership;
    },
    [cid],
  );

  const deactivateMembership = useCallback((personId: string) => {
    const m = db.members.find((x) => x.companyId === cid && x.personId === personId && x.status === 'active');
    if (!m) return;
    updateRow('company_members', m.id, {
      status: 'inactive',
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: db.personId,
    });
  }, [cid]);

  return { activeMemberships, getMembershipForPerson, createMembership, deactivateMembership };
}
