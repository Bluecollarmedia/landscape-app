/**
 * What a worker works on (supabase/updates/078_invite_links.sql). There is no "maintenance worker" versus "regular worker":
 * every worker is added the same way and the owner then switches on the areas: Landscaping, Maintenance, and (separately) Snow.
 * Rows from before update 78 only have the older worker type, which means Maintenance-only when it says 'maintenance'.
 */
import type { CompanyMember } from '@/types/company';

type Areas = Pick<CompanyMember, 'workerType' | 'worksLandscaping' | 'worksMaintenance'>;

export function worksOnMaintenance(m?: Areas): boolean {
  if (!m) return false;
  return m.worksMaintenance ?? m.workerType === 'maintenance';
}

export function worksOnLandscaping(m?: Areas): boolean {
  if (!m) return false;
  return m.worksLandscaping ?? m.workerType !== 'maintenance';
}
