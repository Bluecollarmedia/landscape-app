import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { loadMySnowProperties } from '@/data/snowNotifications';

export interface MySnowProperty { id: string; name: string; address: string }

/**
 * The Snow properties linked to the signed-in customer. Empty while loading and if the check
 * fails, so a customer who is not enrolled never sees Snow. Re-checked every time the screen
 * comes into view.
 */
export function useMySnowProperties(): MySnowProperty[] {
  const [list, setList] = useState<MySnowProperty[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadMySnowProperties().then((res) => { if (alive) setList(res.ok ? res.data : []); });
      return () => { alive = false; };
    }, []),
  );
  return list;
}

/**
 * Does the signed-in customer have at least one Snow property linked to their
 * account? False while loading and if the check fails, so a landscaping-only
 * customer never sees a Snow section. Re-checked every time the screen comes
 * into view, so a property the owner has just linked shows up without signing out.
 */
export function useHasSnow(): boolean {
  const [has, setHas] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadMySnowProperties().then((res) => {
        if (alive) setHas(res.ok && res.data.length > 0);
      });
      return () => { alive = false; };
    }, []),
  );
  return has;
}
