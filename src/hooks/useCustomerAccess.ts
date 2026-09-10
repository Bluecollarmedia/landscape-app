import { useState, useCallback } from 'react';
import { mockProjects, mockSettings, mockPeople } from '@/data/mock';
import type { CustomerProjectAccess } from '@/types/project';

type ValidateResult =
  | { valid: true; projectName: string; projectId: string }
  | { valid: false; error: 'invalid_code' | 'already_claimed' | 'portal_disabled' };

type ClaimResult =
  | { success: true; projectId: string }
  | { success: false; error: string };

export function useCustomerAccess() {
  const [isLoading, setIsLoading] = useState(false);

  const validateCode = useCallback(async (code: string): Promise<ValidateResult> => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsLoading(false);

    const normalized = code.trim().toUpperCase();
    const project = mockProjects.find((p) => p.customerProjectCode === normalized);

    if (!project) {
      return { valid: false, error: 'invalid_code' };
    }

    const settings = mockSettings[project.id];
    if (settings && !settings.customerInteractionEnabled) {
      return { valid: false, error: 'portal_disabled' };
    }

    if (project.customerClaimedBy) {
      return { valid: false, error: 'already_claimed' };
    }

    return { valid: true, projectName: project.name, projectId: project.id };
  }, []);

  const claimProject = useCallback(async (code: string, userId: string): Promise<ClaimResult> => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsLoading(false);

    const normalized = code.trim().toUpperCase();
    const project = mockProjects.find((p) => p.customerProjectCode === normalized);

    if (!project) return { success: false, error: 'invalid_code' };
    if (project.customerClaimedBy && project.customerClaimedBy !== userId) {
      return { success: false, error: 'already_claimed' };
    }

    project.customerClaimedBy = userId;
    project.customerClaimedAt = new Date().toISOString();
    project.customerId = userId;

    return { success: true, projectId: project.id };
  }, []);

  const getAccessForProject = useCallback((projectId: string): CustomerProjectAccess | null => {
    const project = mockProjects.find((p) => p.id === projectId);
    if (!project) return null;
    const settings = mockSettings[projectId];

    const claimedPerson = project.customerClaimedBy
      ? mockPeople[project.customerClaimedBy]
      : undefined;

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

  const revokeAccess = useCallback(async (projectId: string): Promise<void> => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setIsLoading(false);

    const project = mockProjects.find((p) => p.id === projectId);
    if (project) {
      project.customerClaimedBy = undefined;
      project.customerClaimedAt = undefined;
      project.customerId = undefined;
    }
  }, []);

  const regenerateCode = useCallback(async (projectId: string): Promise<string> => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setIsLoading(false);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    const project = mockProjects.find((p) => p.id === projectId);
    if (project) {
      project.customerProjectCode = code;
      project.customerClaimedBy = undefined;
      project.customerClaimedAt = undefined;
      project.customerId = undefined;
    }

    return code;
  }, []);

  return { validateCode, claimProject, getAccessForProject, revokeAccess, regenerateCode, isLoading };
}
