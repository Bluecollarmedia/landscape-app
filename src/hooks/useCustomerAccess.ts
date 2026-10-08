import { useState, useCallback } from 'react';
import { db, updateRow, rpc, refresh, isDemo, useDb } from '@/data/store';
import { supabase } from '@/lib/supabase';
import type { CustomerProjectAccess } from '@/types/project';

type ValidateResult =
  | { valid: true; projectName: string; projectId: string }
  | { valid: false; error: 'invalid_code' | 'already_claimed' | 'portal_disabled' };

type ClaimResult =
  | { success: true; projectId: string }
  | { success: false; error: string };

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A fresh 8-character customer portal code (no 0/O/1/I to avoid mix-ups). */
export function generateProjectCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export function useCustomerAccess() {
  useDb();
  const [isLoading, setIsLoading] = useState(false);

  /** Checks a customer's project code. Works before sign-in. */
  const validateCode = useCallback(async (code: string): Promise<ValidateResult> => {
    setIsLoading(true);
    try {
      const normalized = code.trim().toUpperCase();
      if (isDemo()) {
        await new Promise((r) => setTimeout(r, 600));
        const project = db.projects.find((p) => p.customerProjectCode === normalized);
        if (!project) return { valid: false, error: 'invalid_code' };
        const settings = db.settings[project.id];
        if (settings && !settings.customerInteractionEnabled) return { valid: false, error: 'portal_disabled' };
        if (project.customerClaimedBy) return { valid: false, error: 'already_claimed' };
        return { valid: true, projectName: project.name, projectId: project.id };
      }
      const { data, error } = await supabase.rpc('lookup_project_code', { p_code: normalized });
      const r = (data ?? {}) as { valid?: boolean; project_id?: string; project_name?: string; portal_enabled?: boolean; claimed?: boolean };
      if (error || !r.valid || !r.project_id) return { valid: false, error: 'invalid_code' };
      if (r.portal_enabled === false) return { valid: false, error: 'portal_disabled' };
      if (r.claimed) return { valid: false, error: 'already_claimed' };
      return { valid: true, projectName: r.project_name ?? 'Your project', projectId: r.project_id };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Links the project to the signed-in customer. */
  const claimProject = useCallback(async (code: string, userId: string): Promise<ClaimResult> => {
    setIsLoading(true);
    try {
      const normalized = code.trim().toUpperCase();
      if (isDemo()) {
        await new Promise((r) => setTimeout(r, 800));
        const project = db.projects.find((p) => p.customerProjectCode === normalized);
        if (!project) return { success: false, error: 'invalid_code' };
        if (project.customerClaimedBy && project.customerClaimedBy !== userId) {
          return { success: false, error: 'already_claimed' };
        }
        updateRow('projects', project.id, {
          customerClaimedBy: userId,
          customerClaimedAt: new Date().toISOString(),
          customerId: userId,
        });
        return { success: true, projectId: project.id };
      }
      const { data, error } = await rpc<{ success: boolean; error?: string; project_id?: string }>('claim_project', { p_code: normalized });
      if (error) return { success: false, error: error.message };
      if (!data?.success || !data.project_id) return { success: false, error: data?.error ?? 'invalid_code' };
      return { success: true, projectId: data.project_id };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAccessForProject = useCallback((projectId: string): CustomerProjectAccess | null => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return null;
    const settings = db.settings[projectId];
    const claimedPerson = project.customerClaimedBy ? db.people[project.customerClaimedBy] : undefined;

    return {
      projectId: project.id,
      projectName: project.name,
      code: project.customerProjectCode ?? '',
      portalEnabled: settings?.customerInteractionEnabled ?? false,
      claimedBy: project.customerClaimedBy,
      claimedByEmail: claimedPerson?.email,
      claimedAt: project.customerClaimedAt,
    };
  }, []);

  /** Removes the customer's access to this project. */
  const revokeAccess = useCallback(async (projectId: string): Promise<void> => {
    updateRow('projects', projectId, {
      customerClaimedBy: undefined,
      customerClaimedAt: undefined,
      customerId: undefined,
    });
  }, []);

  /** New portal code; the old one stops working and any claim is cleared. */
  const regenerateCode = useCallback(async (projectId: string): Promise<string> => {
    setIsLoading(true);
    try {
      if (isDemo()) {
        await new Promise((r) => setTimeout(r, 500));
        const code = generateProjectCode();
        updateRow('projects', projectId, {
          customerProjectCode: code,
          customerClaimedBy: undefined,
          customerClaimedAt: undefined,
          customerId: undefined,
        });
        return code;
      }
      const { data, error } = await rpc<string>('regenerate_project_code', { p_project_id: projectId });
      if (error || !data) throw new Error(error?.message ?? 'Could not create a new code');
      await refresh('projects');
      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { validateCode, claimProject, getAccessForProject, revokeAccess, regenerateCode, isLoading };
}
