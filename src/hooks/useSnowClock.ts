import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { canClockIn, clockIn, loadShifts, startOfWeekIso, type SnowShift } from '@/data/snowShifts';

/**
 * A Snow worker's clock state, for any screen that shows it (the Route page's "Clock in for the storm" card and the Time Clock tab). There
 * is one clock: whichever screen is showing reads it fresh every time the person comes to it, so the two can never disagree.
 * `open` is the shift they are clocked in on, if any; `allowed` is whether the database would let them clock in right now (on a route in a
 * dispatched storm).
 */
export function useSnowClock() {
  const [open, setOpen] = useState<SnowShift | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [shifts, can] = await Promise.all([loadShifts(startOfWeekIso()), canClockIn()]);
    if (shifts.ok) setOpen(shifts.data.find((s) => !s.originalOut) ?? null);
    setAllowed(can);
    setLoading(false);
  }, []);

  // Tabs stay mounted, so reload each time this screen comes back to the front.
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  /** Clocks in, then reads the clock again. Resolves with an error sentence, or null when it worked. */
  const clockInNow = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    const res = await clockIn();
    setBusy(false);
    await refresh();
    return res.ok ? null : res.error;
  }, [refresh]);

  return { open, allowed, loading, busy, refresh, clockInNow };
}
