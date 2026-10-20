/**
 * Snow onboarding: the owner's Snow signup code, Snow access requests, and
 * who is on the snow team.
 *
 * Kept apart from the landscaping team code / join requests
 * (useOnboarding.ts). Every read and write goes through database functions in
 * supabase/updates/023_snow_onboarding.sql, which check that the caller is the
 * owner/admin (or, for the applicant functions, that they act on themselves).
 * In demo mode (no Supabase) it works on a small in-memory sample.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type SnowService = 'plowing' | 'shoveling' | 'salting';
export const SNOW_SERVICES: { key: SnowService; label: string }[] = [
  { key: 'plowing', label: 'Plowing' },
  { key: 'shoveling', label: 'Shoveling / Sidewalks' },
  { key: 'salting', label: 'Salting' },
];
export function snowServiceLabel(s: string): string {
  return SNOW_SERVICES.find((x) => x.key === s)?.label ?? s;
}

export type SnowRequestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn' | 'removed';

export interface SnowAccessRequest {
  id: string;
  personId: string;
  status: SnowRequestStatus;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  reviewedAt?: string;
  declineReason?: string;
  grantedServices: SnowService[];
  /** False once the code they used was regenerated or turned off. */
  codeStillActive: boolean;
  /** Their landscaping role, when they already work on the landscaping side. */
  landscapingRole?: string;
}

export interface SnowMember {
  personId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  services: SnowService[];
  status: 'active' | 'revoked';
  approvedAt?: string;
  revokedAt?: string;
  landscapingRole?: string;
}

/** The signed-in person's own standing with snow (from get_my_snow_status). */
export interface MySnowStatus {
  request: { id: string; status: SnowRequestStatus; companyName: string; declineReason?: string; createdAt: string } | null;
  member: { companyId: string; status: 'active' | 'revoked'; services: SnowService[] } | null;
}

type Result = { ok: true } | { ok: false; error: string };

function friendly(message: string | undefined): string {
  if (!message) return 'Something went wrong. Please try again.';
  if (message.includes('pick at least one')) return 'Pick at least one snow service.';
  if (message.includes('no longer pending')) return 'Someone already answered this request.';
  if (message.includes('not allowed')) return 'Only the owner can do this.';
  if (message.includes('Could not find the function') || message.includes('does not exist')) {
    return 'Snow sign-up isn’t set up in the database yet. Run the Snow onboarding update in Supabase.';
  }
  return message;
}

// ── Demo-mode sample (no Supabase) ──────────────────────────────

const demo = {
  code: 'SNOW-7KQ4HM' as string | null,
  requests: [
    {
      id: 'sr1', personId: 'snow-p1', status: 'pending', firstName: 'Dylan', lastName: 'Kowalski',
      email: 'dylan.k@gmail.com', phone: '(248) 555-0142', createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
      grantedServices: [], codeStillActive: true,
    },
    {
      id: 'sr2', personId: 'worker1', status: 'pending', firstName: 'Marcus', lastName: 'Rivera',
      email: 'marcus@brightonlawn.com', createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
      grantedServices: [], codeStillActive: true, landscapingRole: 'worker',
    },
  ] as SnowAccessRequest[],
  members: [
    {
      personId: 'snow-p2', firstName: 'Ana', lastName: 'Duarte', email: 'ana.duarte@gmail.com',
      services: ['shoveling', 'salting'], status: 'active', approvedAt: '2026-10-01T14:00:00Z',
    },
  ] as SnowMember[],
};
const listeners = new Set<() => void>();
function demoChanged() {
  listeners.forEach((l) => l());
}

function randomSnowCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'SNOW-';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ── Applicant side ──────────────────────────────────────────────

/** Checks a Snow code. Works before sign-in. */
export async function lookupSnowCode(code: string): Promise<{ valid: boolean; companyName?: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false };
  if (!isSupabaseConfigured) {
    return demo.code && trimmed.toUpperCase() === demo.code ? { valid: true, companyName: 'Brighton Lawn + Landscape' } : { valid: false };
  }
  const { data, error } = await supabase.rpc('lookup_snow_code', { p_code: trimmed });
  if (error || !data) return { valid: false };
  const r = data as { valid: boolean; company_name?: string };
  return { valid: !!r.valid, companyName: r.company_name };
}

/**
 * One code box for everything: works out whether a code is a team code or a Snow code (the DATABASE decides, so a phone can't
 * turn one into the other). Works before sign-in. Says only whether it works, the company name and the kind.
 */
export async function lookupAnyCode(code: string): Promise<{ valid: boolean; kind?: 'team' | 'snow'; companyName?: string; workerType?: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false };
  if (!isSupabaseConfigured) {
    if (demo.code && trimmed.toUpperCase() === demo.code) return { valid: true, kind: 'snow', companyName: 'Brighton Lawn + Landscape' };
    return { valid: false };
  }
  const { data, error } = await supabase.rpc('lookup_any_code', { p_code: trimmed });
  if (error || !data) return { valid: false };
  const r = data as { valid: boolean; kind?: 'team' | 'snow'; company_name?: string; worker_type?: string };
  return { valid: !!r.valid, kind: r.kind, companyName: r.company_name, workerType: r.worker_type };
}

/** Files a Snow access request for the signed-in person (safe to repeat). */
export async function requestSnowAccess(code: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const { data, error } = await supabase.rpc('request_snow_access', { p_code: code.trim() });
  if (error) return { ok: false, error: friendly(error.message) };
  const r = data as { success: boolean; error?: string };
  if (r?.success) return { ok: true };
  if (r?.error === 'already_member') return { ok: false, error: 'You’re already on the snow team.' };
  return { ok: false, error: 'That Snow code doesn’t work anymore. Ask the owner for the current one.' };
}

export async function fetchMySnowStatus(): Promise<MySnowStatus | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('get_my_snow_status');
  if (error || !data) return null;
  const d = data as { request: any; member: any };
  return {
    request: d.request
      ? {
          id: d.request.id,
          status: d.request.status,
          companyName: d.request.company_name,
          declineReason: d.request.decline_reason ?? undefined,
          createdAt: d.request.created_at,
        }
      : null,
    member: d.member
      ? { companyId: d.member.company_id, status: d.member.status, services: d.member.services ?? [] }
      : null,
  };
}

export async function withdrawMySnowRequest(): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const { error } = await supabase.rpc('withdraw_my_snow_request');
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** The signed-in person's snow standing, for a screen that shows it. */
export function useMySnowStatus() {
  const [status, setStatus] = useState<MySnowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchMySnowStatus());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { status, loading, reload };
}

// ── Owner side ──────────────────────────────────────────────────

function mapRequest(r: any): SnowAccessRequest {
  return {
    id: r.id,
    personId: r.person_id,
    status: r.status,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    email: r.email ?? '',
    phone: r.phone ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at ?? undefined,
    declineReason: r.decline_reason ?? undefined,
    grantedServices: r.granted_services ?? [],
    codeStillActive: !!r.code_still_active,
    landscapingRole: r.landscaping_role ?? undefined,
  };
}

function mapMember(m: any): SnowMember {
  return {
    personId: m.person_id,
    firstName: m.first_name ?? '',
    lastName: m.last_name ?? '',
    email: m.email ?? '',
    phone: m.phone ?? undefined,
    avatarUrl: m.avatar_url ?? undefined,
    services: m.services ?? [],
    status: m.status,
    approvedAt: m.approved_at ?? undefined,
    revokedAt: m.revoked_at ?? undefined,
    landscapingRole: m.landscaping_role ?? undefined,
  };
}

/**
 * Everything the owner's Snow Team screen needs: the current code, every
 * request, and the snow team. Each action calls the database and then
 * reloads, so the screen always shows what was actually saved.
 */
export function useSnowOnboardingAdmin() {
  const [code, setCode] = useState<string | null>(null);
  const [requests, setRequests] = useState<SnowAccessRequest[]>([]);
  const [members, setMembers] = useState<SnowMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCode(demo.code);
      setRequests(demo.requests.slice());
      setMembers(demo.members.slice());
      setLoading(false);
      return;
    }
    try {
      const [codeRes, reqRes, memRes] = await Promise.all([
        supabase.from('snow_signup_codes').select('code').eq('is_active', true).maybeSingle(),
        supabase.rpc('list_snow_access_requests'),
        supabase.rpc('list_snow_members'),
      ]);
      const err = codeRes.error ?? reqRes.error ?? memRes.error;
      if (err) {
        setLoadError(friendly(err.message));
      } else {
        setLoadError(null);
        setCode((codeRes.data as { code: string } | null)?.code ?? null);
        setRequests(((reqRes.data as any[]) ?? []).map(mapRequest));
        setMembers(((memRes.data as any[]) ?? []).map(mapMember));
      }
    } catch (e: any) {
      setLoadError(friendly(e?.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    if (!isSupabaseConfigured) {
      listeners.add(reload);
      return () => {
        listeners.delete(reload);
      };
    }
  }, [reload]);

  const call = useCallback(
    async (fn: string, args: Record<string, unknown>, demoApply: () => void): Promise<Result> => {
      if (!isSupabaseConfigured) {
        demoApply();
        demoChanged();
        return { ok: true };
      }
      const { error } = await supabase.rpc(fn, args);
      await reload();
      return error ? { ok: false, error: friendly(error.message) } : { ok: true };
    },
    [reload],
  );

  const regenerateCode = useCallback(
    () =>
      call('regenerate_snow_signup_code', {}, () => {
        demo.code = randomSnowCode();
        demo.requests.forEach((r) => (r.codeStillActive = false));
      }),
    [call],
  );

  const disableCode = useCallback(
    () =>
      call('disable_snow_signup_code', {}, () => {
        demo.code = null;
        demo.requests.forEach((r) => (r.codeStillActive = false));
      }),
    [call],
  );

  const approve = useCallback(
    (req: SnowAccessRequest, services: SnowService[]) => {
      if (services.length === 0) return Promise.resolve<Result>({ ok: false, error: 'Pick at least one snow service.' });
      return call('approve_snow_access_request', { p_request_id: req.id, p_services: services }, () => {
        const r = demo.requests.find((x) => x.id === req.id);
        if (!r || r.status !== 'pending') return;
        Object.assign(r, { status: 'approved', grantedServices: services, reviewedAt: new Date().toISOString() });
        demo.members = demo.members.filter((m) => m.personId !== r.personId);
        demo.members.push({
          personId: r.personId, firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone,
          services, status: 'active', approvedAt: new Date().toISOString(), landscapingRole: r.landscapingRole,
        });
      });
    },
    [call],
  );

  const decline = useCallback(
    (req: SnowAccessRequest, reason?: string) =>
      call('decline_snow_access_request', { p_request_id: req.id, p_reason: reason ?? null }, () => {
        const r = demo.requests.find((x) => x.id === req.id);
        if (r?.status === 'pending') Object.assign(r, { status: 'declined', declineReason: reason, reviewedAt: new Date().toISOString() });
      }),
    [call],
  );

  const remove = useCallback(
    (req: SnowAccessRequest) =>
      call('remove_snow_access_request', { p_request_id: req.id }, () => {
        const r = demo.requests.find((x) => x.id === req.id);
        if (r?.status === 'pending') Object.assign(r, { status: 'removed', reviewedAt: new Date().toISOString() });
      }),
    [call],
  );

  const setServices = useCallback(
    (member: SnowMember, services: SnowService[]) => {
      if (services.length === 0) return Promise.resolve<Result>({ ok: false, error: 'Pick at least one snow service.' });
      return call('set_snow_member_services', { p_person_id: member.personId, p_services: services }, () => {
        const m = demo.members.find((x) => x.personId === member.personId);
        if (m) Object.assign(m, { services, status: 'active', revokedAt: undefined });
      });
    },
    [call],
  );

  /** Gives an existing landscaping worker snow access directly (database function snow_grant_access); no request needed. */
  const grantAccess = useCallback(
    (person: { personId: string; firstName: string; lastName: string; email: string; phone?: string }, services: SnowService[]) => {
      if (services.length === 0) return Promise.resolve<Result>({ ok: false, error: 'Pick at least one snow service.' });
      return call('snow_grant_access', { p_person_id: person.personId, p_services: services }, () => {
        demo.members = demo.members.filter((m) => m.personId !== person.personId);
        demo.members.push({
          personId: person.personId, firstName: person.firstName, lastName: person.lastName, email: person.email, phone: person.phone,
          services, status: 'active', approvedAt: new Date().toISOString(), landscapingRole: 'worker',
        });
      });
    },
    [call],
  );

  const revoke = useCallback(
    (member: SnowMember) =>
      call('revoke_snow_access', { p_person_id: member.personId }, () => {
        const m = demo.members.find((x) => x.personId === member.personId);
        if (m) Object.assign(m, { status: 'revoked', revokedAt: new Date().toISOString() });
      }),
    [call],
  );

  const pending = requests.filter((r) => r.status === 'pending');

  return {
    code, requests, pending, members, loading, loadError, reload,
    regenerateCode, disableCode, approve, decline, remove, setServices, revoke, grantAccess,
  };
}
