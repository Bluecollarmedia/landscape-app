/**
 * Adds an existing landscaping customer's property to Snow Mode without
 * re-typing the customer or making a second account. Writes only through the
 * tables the Snow property screen already uses (snow_properties and
 * snow_property_contacts); no new database functions. The contact link is what
 * makes the property show in the customer's own app.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { addContact } from '@/data/snowProperties';
import type { KnownPlace } from '@/lib/snowExisting';

export type AddResult =
  | { ok: true; propertyId: string; createdProperty: boolean; linkedCustomer: boolean }
  | { ok: false; error: string; /** The property was made but the customer link failed; retrying finds it and only links. */ propertyId?: string };

export interface CustomerToLink {
  personId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

const NOT_CONNECTED = "Snow properties need the live database, which isn't connected in this version of the app.";

/**
 * Makes (or reuses) the Snow property and links the customer's app account to it.
 *  - `existingPropertyId`: a Snow property already at this address; nothing new is created.
 *  - The customer is linked once: if they are already a contact on the property, nothing is added.
 */
export async function addCustomerPlaceToSnow(args: {
  companyId: string;
  customer: CustomerToLink;
  place: Pick<KnownPlace, 'address' | 'city' | 'state' | 'zip'>;
  propertyName: string;
  existingPropertyId?: string;
}): Promise<AddResult> {
  if (!isSupabaseConfigured) return { ok: false, error: NOT_CONNECTED };
  const { companyId, customer, place, propertyName, existingPropertyId } = args;

  let propertyId = existingPropertyId;
  let createdProperty = false;
  if (!propertyId) {
    const { data, error } = await supabase.from('snow_properties').insert({
      company_id: companyId,
      name: propertyName.trim(),
      address: place.address.trim(),
      city: place.city?.trim() || null,
      state: place.state?.trim() || null,
      zip: place.zip?.trim() || null,
    }).select('id').single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Could not add the property. Try again.' };
    propertyId = data.id as string;
    createdProperty = true;
  }

  const { data: contacts, error: contactsError } = await supabase
    .from('snow_property_contacts')
    .select('id, person_id, is_primary')
    .eq('property_id', propertyId)
    .is('removed_at', null);
  if (contactsError) return { ok: false, error: contactsError.message, propertyId };

  if ((contacts ?? []).some((c) => c.person_id === customer.personId)) {
    return { ok: true, propertyId, createdProperty, linkedCustomer: false };
  }

  const name = `${customer.firstName} ${customer.lastName}`.trim() || customer.email || 'Customer';
  const hasPrimary = (contacts ?? []).some((c) => c.is_primary);
  const linked = await addContact(companyId, propertyId, {
    name,
    email: customer.email,
    phone: customer.phone,
    personId: customer.personId,
    isPrimary: !hasPrimary,
  });
  if (!linked.ok) return { ok: false, error: linked.error, propertyId };
  return { ok: true, propertyId, createdProperty, linkedCustomer: true };
}
