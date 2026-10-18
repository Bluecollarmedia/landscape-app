/**
 * Customer codes for maintenance properties (supabase/updates/037).
 *
 * Every maintenance property has a code. The customer enters it where project
 * codes go ("Customer? View your project") and is linked to that property, so
 * a maintenance customer can get in without a regular project. Only the
 * owner/admin can see or change the codes.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const NOT_CONNECTED = "Customer codes need the live database, which isn't connected in this version of the app.";

/** The property's current code, or null if it has none yet. */
export async function loadMaintenanceCode(propertyId: string): Promise<Result<string | null>> {
  if (!isSupabaseConfigured) return { ok: false, error: NOT_CONNECTED };
  const { data, error } = await supabase
    .from('maintenance_customer_codes').select('code').eq('property_id', propertyId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data?.code ?? null };
}

/**
 * A new code for the property: the old one stops working. With `revoke`, the
 * customer who used the old code is also unlinked and loses access.
 */
export async function regenerateMaintenanceCode(propertyId: string, revoke = false): Promise<Result<string>> {
  if (!isSupabaseConfigured) return { ok: false, error: NOT_CONNECTED };
  const { data, error } = await supabase.rpc('regenerate_maintenance_code', {
    p_property_id: propertyId,
    p_revoke: revoke,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as string };
}
