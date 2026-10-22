import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveChoice, type WorkerShellChoice } from '@/lib/modeChoice';

/** The worker's Snow / Landscaping toggle, kept on this phone (it is a per-phone view choice, not a permission). */
const KEY = 'worker-mode-choice';
type Saved = { at: string; choice: WorkerShellChoice } | null;

let saved: Saved = null;
let started = false;
/** True once the phone's saved choice (if any) has been read. */
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function start() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(KEY)
    .then((v) => { try { saved = v ? (JSON.parse(v) as Saved) : null; } catch { saved = null; } loaded = true; emit(); })
    .catch(() => { loaded = true; emit(); });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useWorkerModeChoice(changedAt: string | undefined) {
  start();
  const snapshot = useSyncExternalStore(subscribe, () => saved, () => saved);
  const isLoaded = useSyncExternalStore(subscribe, () => loaded, () => loaded);
  const choice = resolveChoice(snapshot, changedAt);
  const setChoice = (next: WorkerShellChoice) => {
    saved = { at: changedAt ?? '', choice: next };
    emit();
    AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
  };
  return { choice, setChoice, loaded: isLoaded };
}
