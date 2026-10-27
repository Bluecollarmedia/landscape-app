import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useWorkerContext } from '@/providers/WorkerProvider';

// Decided once each time the app is opened (this is module state, so it resets on a cold start and not when switching tabs).
let handled = false;

/**
 * Opening the app while you have not clocked in yet takes you to the Clock tab, so the first thing you see is Clock In. It only happens
 * once per app open, only once the time clock has answered, and never when you are already clocked in, already clocked out for the day,
 * have a day waiting to be reviewed, or are not put on any work today (then there is nothing to clock in to).
 */
export function useOpenOnClock() {
  const router = useRouter();
  const { workday: w } = useWorkerContext();
  useEffect(() => {
    if (handled) return;
    if (w.installed === null || !w.day) return; // still waiting for the first answer
    handled = true;
    if (w.installed === true && !w.active && !w.today && !w.stale && w.day.canClockIn !== false) {
      router.navigate('/(worker)/(tabs)/clock' as any);
    }
  }, [w.installed, w.day, w.active, w.today, w.stale, router]);
}
