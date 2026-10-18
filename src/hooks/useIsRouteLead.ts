import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { loadMyRoutes } from '@/data/snowRoutes';

/**
 * Does this snow worker lead any route? null while unknown. Route screens are
 * only for leads: the database already shows a worker only the routes they
 * lead, so this just decides whether the Route tab is worth showing. It checks
 * again every minute and when the app comes back to the front, so a worker the
 * owner has just made a lead sees the tab without signing out.
 */
export function useIsRouteLead(): boolean | null {
  const [lead, setLead] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = () => {
      loadMyRoutes().then((res) => {
        // A failed check never hides the tab; it stays as it was.
        if (alive && res.ok) setLead(res.data.length > 0);
      });
    };
    check();
    const timer = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => { alive = false; clearInterval(timer); sub.remove(); };
  }, []);

  return lead;
}
