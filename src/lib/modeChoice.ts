// A worker's own choice between Snow Mode and Landscaping while the company is in Snow Mode. Pure functions; the phone's saved
// copy lives in hooks/useWorkerModeChoice.ts.

export type WorkerShellChoice = 'snow' | 'landscaping';

/** The toggle shows for a worker who may use both modes, only while the owner has Snow Mode on. */
export function canToggleMode(role: string | null | undefined, mode: string, access: { snow: boolean; landscaping: boolean }): boolean {
  return role === 'worker' && mode === 'snow' && access.snow && access.landscaping;
}

/**
 * Which side the worker is on. A saved choice only counts for the SAME Snow Mode switch it was made in: when the owner switches
 * modes again, everyone starts in Snow Mode (the default) and can use the toggle from there.
 */
export function resolveChoice(saved: { at?: string; choice?: string } | null | undefined, changedAt: string | undefined): WorkerShellChoice {
  if (saved && (saved.at ?? '') === (changedAt ?? '') && (saved.choice === 'snow' || saved.choice === 'landscaping')) return saved.choice;
  return 'snow';
}
