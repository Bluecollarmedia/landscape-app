/**
 * Truck documents (insurance, registration, any PDF or photo) and the owner's private notes (supabase/updates/056).
 * Only the company owner can read or change either one: the database enforces it, and these screens only show for the owner.
 * Files are uploaded to the company's photo storage first; the row that points at the file is saved once the upload worked.
 */
import { useMemo } from 'react';
import { db, useDb, insertRow, updateRow, deleteRow, rowsOf } from '@/data/store';
import { uploadImage, removeMedia } from '@/lib/media';
import { isAllowedDocument, noteProblem, suggestedTitle, type DocKind } from '@/lib/truckDocs';
import type { TruckDocument, TruckNote } from '@/types/truck';

export type Result = { ok: true } | { ok: false; error: string };

/** Whether this person may see truck documents and notes (the company owner). */
export function useIsOwner(): boolean {
  useDb();
  return db.role === 'owner';
}

export interface DocumentInput {
  kind: DocKind;
  title: string;
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
  expiresOn?: string;
}

export async function addTruckDocument(truckId: string, input: DocumentInput): Promise<Result> {
  if (!isAllowedDocument(input.mimeType, input.name)) return { ok: false, error: 'Choose a PDF or a photo (JPEG, PNG, HEIC).' };
  try {
    const { url, key } = await uploadImage(input.uri, `${db.companyId}/trucks/${truckId}`, input.mimeType);
    insertRow('truck_documents', {
      truckId,
      kind: input.kind,
      title: input.title.trim() || suggestedTitle(input.kind, input.name),
      fileUrl: url,
      fileKey: key,
      contentType: input.mimeType,
      sizeBytes: input.size,
      expiresOn: input.expiresOn || undefined,
      createdBy: db.personId,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The file couldn't be uploaded." };
  }
}

export function updateTruckDocument(id: string, patch: { title?: string; kind?: DocKind; expiresOn?: string | null }) {
  updateRow('truck_documents', id, { ...patch, ...(patch.expiresOn === null ? { expiresOn: null } : {}) } as Record<string, unknown>);
}

/** Removes the record and, best effort, the stored file. */
export function removeTruckDocument(doc: TruckDocument) {
  deleteRow('truck_documents', doc.id);
  if (doc.fileKey && !/^https?:\/\//i.test(doc.fileKey)) removeMedia(doc.fileKey).catch(() => {});
}

export function addTruckNote(truckId: string, body: string): Result {
  const problem = noteProblem(body);
  if (problem) return { ok: false, error: problem };
  insertRow('truck_notes', { truckId, body: body.trim(), createdBy: db.personId });
  return { ok: true };
}

export function updateTruckNote(id: string, body: string): Result {
  const problem = noteProblem(body);
  if (problem) return { ok: false, error: problem };
  updateRow('truck_notes', id, { body: body.trim() });
  return { ok: true };
}

export const deleteTruckNote = (id: string) => deleteRow('truck_notes', id);

export function useTruckDocuments(truckId: string | undefined): TruckDocument[] {
  const v = useDb();
  return useMemo(
    () => (rowsOf('truck_documents') as unknown as TruckDocument[]).filter((d) => d.truckId === truckId).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [truckId, v],
  );
}

export function useTruckNotes(truckId: string | undefined): TruckNote[] {
  const v = useDb();
  return useMemo(
    () => (rowsOf('truck_notes') as unknown as TruckNote[]).filter((n) => n.truckId === truckId).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [truckId, v],
  );
}
