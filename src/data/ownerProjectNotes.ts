/**
 * The owner's private notes, pictures and materials lists for a project (supabase/updates/057). They belong to the project, so
 * notes written while quoting are still there when the quote is approved and the project is running. Only the company owner can
 * read or change any of it: the database enforces it, and the screens only show it to the owner.
 */
import { useMemo } from 'react';
import { db, useDb, insertRow, updateRow, deleteRow, rowsOf } from '@/data/store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uploadImage, removeMedia } from '@/lib/media';
import { noteProblem } from '@/lib/truckDocs';
import { MAX_SOURCE_CHARS, listToStored, normalizeMaterialList, notesAsText, type MaterialList } from '@/lib/materialList';
import type { OwnerMaterialList, OwnerProjectNote, OwnerProjectPhoto } from '@/types/project';

export type Result = { ok: true } | { ok: false; error: string };

/** Whether this person may see the private notes (the company owner). */
export function useIsProjectOwner(): boolean {
  useDb();
  return db.role === 'owner';
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

export function useOwnerNotes(projectId: string | undefined): OwnerProjectNote[] {
  const v = useDb();
  return useMemo(() => (rowsOf('owner_project_notes') as unknown as OwnerProjectNote[]).filter((n) => n.projectId === projectId).sort(byNewest), [projectId, v]);
}
export function useOwnerPhotos(projectId: string | undefined): OwnerProjectPhoto[] {
  const v = useDb();
  return useMemo(() => (rowsOf('owner_project_photos') as unknown as OwnerProjectPhoto[]).filter((n) => n.projectId === projectId).sort(byNewest), [projectId, v]);
}
export function useOwnerMaterialLists(projectId: string | undefined): OwnerMaterialList[] {
  const v = useDb();
  return useMemo(() => (rowsOf('owner_material_lists') as unknown as OwnerMaterialList[]).filter((n) => n.projectId === projectId).sort(byNewest), [projectId, v]);
}

export function addOwnerNote(projectId: string, body: string): Result {
  const problem = noteProblem(body);
  if (problem) return { ok: false, error: problem };
  insertRow('owner_project_notes', { projectId, body: body.trim(), createdBy: db.personId });
  return { ok: true };
}
export function updateOwnerNote(id: string, body: string): Result {
  const problem = noteProblem(body);
  if (problem) return { ok: false, error: problem };
  updateRow('owner_project_notes', id, { body: body.trim() });
  return { ok: true };
}
export const deleteOwnerNote = (id: string) => deleteRow('owner_project_notes', id);

/** Uploads a picture the owner took or chose, then saves it on the project. */
export async function addOwnerPhoto(projectId: string, localUri: string, caption?: string): Promise<Result> {
  try {
    const { url, key } = await uploadImage(localUri, `${db.companyId}/projects/${projectId}/private`);
    insertRow('owner_project_photos', { projectId, fileUrl: url, fileKey: key, caption: caption?.trim() || undefined, createdBy: db.personId });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The picture couldn't be uploaded." };
  }
}
export function updateOwnerPhotoCaption(id: string, caption: string) {
  updateRow('owner_project_photos', id, { caption: caption.trim() || null } as Record<string, unknown>);
}
export function removeOwnerPhoto(photo: OwnerProjectPhoto) {
  deleteRow('owner_project_photos', photo.id);
  if (photo.fileKey && !/^https?:\/\//i.test(photo.fileKey)) removeMedia(photo.fileKey).catch(() => {});
}

export const deleteMaterialList = (id: string) => deleteRow('owner_material_lists', id);

export const AI_ERRORS: Record<string, string> = {
  ai_not_configured: "The AI sorter isn't set up yet (the AI key is missing on the server). Your notes are safe; try again after it's added.",
  no_notes: 'Write some notes first, then sort them.',
  too_long: `Your notes are too long to sort at once (the limit is about ${MAX_SOURCE_CHARS} characters). Delete old notes or sort them in parts.`,
  not_allowed: 'Only the owner can use this.',
  sign_in_required: 'Please sign in again, then try once more.',
  ai_failed: 'The AI service had a problem. Try again in a minute.',
  bad_answer: "The AI's answer wasn't usable. Try again.",
};

export function describeAiError(code: string | undefined): string {
  if (code && AI_ERRORS[code]) return AI_ERRORS[code];
  if (/not found|404|failed to send a request|functionsfetcherror|edge function/i.test(code ?? '')) {
    return "The AI function isn't deployed yet. Deploy organize-materials in Supabase, then try again.";
  }
  return code ? `Couldn't sort the notes. (${code})` : "Couldn't sort the notes. Please try again.";
}

/** Sends all of this project's notes to the AI sorter and saves the clean list it returns. */
export async function organizeMaterials(projectId: string, projectName: string): Promise<{ ok: true; list: MaterialList } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Sorting notes needs the live app, not demo mode.' };
  const notes = (rowsOf('owner_project_notes') as unknown as OwnerProjectNote[]).filter((n) => n.projectId === projectId);
  const text = notesAsText(notes);
  if (!text.trim()) return { ok: false, error: describeAiError('no_notes') };
  if (text.length > MAX_SOURCE_CHARS) return { ok: false, error: describeAiError('too_long') };
  try {
    const { data, error } = await supabase.functions.invoke('organize-materials', { body: { text, projectName } });
    if (error) {
      let code: string | undefined;
      try { code = (await (error as { context?: Response }).context?.json())?.error; } catch { /* not JSON */ }
      return { ok: false, error: describeAiError(code ?? error.message) };
    }
    if (!data?.ok) return { ok: false, error: describeAiError(data?.error) };
    const list = normalizeMaterialList(data.list, `${projectName} materials`);
    if (list.items.length === 0 && list.otherNotes.length === 0) return { ok: false, error: "The notes didn't have any materials in them yet." };
    insertRow('owner_material_lists', { projectId, title: list.title, items: listToStored(list), sourceText: text, createdBy: db.personId });
    return { ok: true, list };
  } catch (err) {
    return { ok: false, error: describeAiError(err instanceof Error ? err.message : undefined) };
  }
}
