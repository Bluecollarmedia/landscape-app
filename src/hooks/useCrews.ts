import { useCallback, useMemo } from 'react';
import { db, useDb, insertRow, updateRow, deleteRow, rowsOf } from '@/data/store';
import type { Crew, CrewMember } from '@/types/crew';

/** Crews: named groups of workers (e.g. "Maintenance Crew"). A worker is in at
 * most one crew. Owner/admin can change them; everyone in the company can see. */
export function useCrews() {
  const v = useDb();
  const crews = useMemo(() => db.crews, [v]);
  const crewByPerson = useMemo(() => db.crewByPerson, [v]);

  const crewOf = useCallback((personId?: string): Crew | undefined =>
    (personId ? crewByPerson[personId] : undefined), [crewByPerson]);

  /** Puts `personId` in `crewId`, taking them out of any other crew first.
   * `null` takes them out of every crew. */
  const setWorkerCrew = useCallback((personId: string, crewId: string | null) => {
    const rows = rowsOf('crew_members') as CrewMember[];
    const current = rows.find(r => r.personId === personId);
    if (current?.crewId === crewId) return;
    if (current) deleteRow('crew_members', current.id);
    if (crewId) insertRow('crew_members', { crewId, personId });
  }, []);

  /** Makes `personIds` exactly the crew's members. */
  const setCrewMembers = useCallback((crewId: string, personIds: string[]) => {
    const rows = rowsOf('crew_members') as CrewMember[];
    for (const r of rows) {
      if (r.crewId === crewId && !personIds.includes(r.personId)) deleteRow('crew_members', r.id);
    }
    for (const pid of personIds) setWorkerCrew(pid, crewId);
  }, [setWorkerCrew]);

  /** False when another crew already has this name (names are unique, ignoring case). */
  const isNameFree = useCallback((name: string, exceptId?: string) => {
    const key = name.trim().toLowerCase();
    return !db.crews.some(c => c.id !== exceptId && c.name.trim().toLowerCase() === key);
  }, []);

  const createCrew = useCallback((name: string, color: string, personIds: string[]): Crew => {
    const row = insertRow('crews', { name: name.trim(), color });
    setCrewMembers(row.id, personIds);
    return { ...(row as unknown as Crew), memberIds: personIds };
  }, [setCrewMembers]);

  const updateCrew = useCallback((crewId: string, patch: { name?: string; color?: string }) => {
    updateRow('crews', crewId, { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) });
  }, []);

  /** Deletes the crew; its workers stay on the team, just without a crew. */
  const deleteCrew = useCallback((crewId: string) => {
    // The database removes the members with the crew; mirror that locally.
    for (const r of rowsOf('crew_members') as CrewMember[]) {
      if (r.crewId === crewId) deleteRow('crew_members', r.id);
    }
    deleteRow('crews', crewId);
  }, []);

  return { crews, crewOf, setWorkerCrew, setCrewMembers, isNameFree, createCrew, updateCrew, deleteCrew };
}
