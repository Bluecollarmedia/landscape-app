import { useCallback, useEffect, useRef, useState } from 'react';
import { clockIn, clockOut, getMyOpenShift, newClockRequestId } from '@/data/snowTime';
import type { SnowShift } from '@/types/snowTime';

/**
 * The signed-in snow employee's shift clock: whether they're clocked in, and
 * Clock In / Clock Out actions. A failed tap keeps its request id, so tapping
 * again after a dropped connection can't create a second shift.
 * Needs no route, property or service access, and never reads location.
 */
export function useSnowShift(companyId: string | undefined, personId: string | undefined) {
  const [openShift, setOpenShift] = useState<SnowShift | undefined>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const pendingIn = useRef<string | undefined>(undefined);
  const pendingOut = useRef<string | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!companyId || !personId) { setLoading(false); return; }
    const res = await getMyOpenShift(companyId, personId);
    if (res.ok) { setOpenShift(res.data); setError(undefined); } else setError(res.error);
    setLoading(false);
  }, [companyId, personId]);

  useEffect(() => { reload(); }, [reload]);

  const doClockIn = useCallback(async () => {
    if (!companyId || busy) return false;
    setBusy(true);
    pendingIn.current ??= newClockRequestId();
    const res = await clockIn(companyId, pendingIn.current);
    setBusy(false);
    if (!res.ok) { setError(res.error); return false; }
    pendingIn.current = undefined;
    setOpenShift(res.data);
    setError(undefined);
    return true;
  }, [companyId, busy]);

  const doClockOut = useCallback(async () => {
    if (!companyId || busy) return false;
    setBusy(true);
    pendingOut.current ??= newClockRequestId();
    const res = await clockOut(companyId, pendingOut.current);
    setBusy(false);
    if (!res.ok) { setError(res.error); return false; }
    pendingOut.current = undefined;
    setOpenShift(undefined);
    setError(undefined);
    return true;
  }, [companyId, busy]);

  return { openShift, clockedIn: !!openShift, loading, busy, error, clockIn: doClockIn, clockOut: doClockOut, reload };
}
