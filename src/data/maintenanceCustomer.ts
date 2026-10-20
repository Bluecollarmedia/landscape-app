/**
 * A customer's maintenance updates (supabase/updates/034): finished visits to
 * their property and only the photos the owner shared.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface CustomerMaintenanceUpdate {
  stopId: string;
  propertyName: string;
  completedAt: string;
  services?: string;
  photos: { id: string; url: string; key?: string }[];
}

export async function loadCustomerMaintenanceUpdates(): Promise<Result<CustomerMaintenanceUpdate[]>> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Maintenance updates need the live database, which isn't connected in this version of the app." };
  }
  const { data, error } = await supabase.rpc('maintenance_customer_updates');
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, any>[]).map((r) => ({
      stopId: r.stop_id,
      propertyName: r.property_name,
      completedAt: r.completed_at,
      services: r.services ?? undefined,
      photos: (r.photos ?? []) as { id: string; url: string; key?: string }[],
    })),
  };
}

export interface MyMaintenanceProperty { id: string; name: string; address: string }

/** The maintenance properties linked to this customer, even before the first visit. */
export async function loadMyMaintenanceProperties(): Promise<Result<MyMaintenanceProperty[]>> {
  if (!isSupabaseConfigured) return { ok: true, data: [] };
  const { data, error } = await supabase.rpc('maintenance_my_properties');
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, any>[]).map((r) => ({ id: r.id, name: r.name, address: r.address ?? '' })),
  };
}

/** Same list as a hook; asks again each time the screen comes into focus. */
export function useMyMaintenanceProperties(): MyMaintenanceProperty[] {
  const [list, setList] = useState<MyMaintenanceProperty[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadMyMaintenanceProperties().then((res) => { if (alive && res.ok) setList(res.data); });
      return () => { alive = false; };
    }, []),
  );
  return list;
}
