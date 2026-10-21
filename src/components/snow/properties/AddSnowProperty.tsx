/**
 * Add a Snow property (Owner): choose the customer (or add them once), choose their property (or enter the address once), done.
 * The property is the same one landscaping and Maintenance use; Snow just turns on for it. Nothing about the customer or the
 * address is ever typed a second time. After saving you pick plowing, shoveling or salting on the property screen.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Button, Icon, Input, InlineNotice, SearchBar } from '@/components/ui';
import { QuickAddCustomer } from '@/components/customers/QuickAddCustomer';
import { PropertyChoice } from '@/components/properties/PropertyChoice';
import { showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { useCustomers } from '@/hooks/useCustomers';
import { ensureProperty, enableSnowForProperty } from '@/data/properties';
import { applyStreetInput } from '@/lib/address';
import type { Property } from '@/types/property';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const EMPTY = { name: '', address: '', city: '', state: '', zip: '' };

export function AddSnowProperty({ onCancel, onDone }: { onCancel: () => void; onDone: (snowPropertyId: string) => void }) {
  const { colors } = useTheme();
  const { allCustomers } = useCustomers();
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [propertyId, setPropertyId] = useState<string | undefined>();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const customers = useMemo(
    () => allCustomers.slice().sort((a, b) => `${a.person.lastName} ${a.person.firstName}`.localeCompare(`${b.person.lastName} ${b.person.firstName}`)),
    [allCustomers],
  );
  const q = query.trim().toLowerCase();
  const shown = q ? customers.filter((c) => `${c.person.firstName} ${c.person.lastName} ${c.person.email}`.toLowerCase().includes(q)) : customers;
  const customer = customers.find((c) => c.person.id === customerId);
  const set = (k: keyof typeof EMPTY) => (v: string) => setForm({ ...form, [k]: v });

  function pick(p: Property | null) {
    setPropertyId(p?.id);
  }

  async function save() {
    if (!customerId) return showMessage('Choose the customer', 'Pick the customer this property belongs to, or add them below.');
    setSaving(true);
    let pid = propertyId;
    if (!pid) {
      if (!form.address.trim()) { setSaving(false); return showMessage('Add the address', 'Enter the street address so the crew can find the property.'); }
      const made = await ensureProperty(customerId, { name: form.name, address: form.address, city: form.city, state: form.state, zip: form.zip });
      if (!made.ok) { setSaving(false); return showMessage("Couldn't add the property", made.missing ? 'This needs the latest database update (79).' : made.error); }
      pid = made.propertyId;
    }
    const res = await enableSnowForProperty(pid);
    setSaving(false);
    if (!res.ok) return showMessage("Couldn't turn Snow on", res.error);
    setForm(EMPTY);
    onDone(res.snowPropertyId);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]}>Add Property</Text>
        <Button title="Cancel" size="sm" variant="ghost" onPress={onCancel} />
      </View>

      <Text style={[typeScale.overline, { color: colors.textSecondary, marginBottom: spacing.xs }]}>1 · CUSTOMER</Text>
      {customer ? (
        <View style={[styles.picked, { backgroundColor: colors.primarySurface }]}>
          <Icon name="user" size={18} color={colors.primary} />
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1, fontWeight: '600' }]}>{`${customer.person.firstName} ${customer.person.lastName}`.trim()}</Text>
          <Button title="Change" size="sm" variant="ghost" onPress={() => { setCustomerId(undefined); setPropertyId(undefined); }} />
        </View>
      ) : (
        <>
          {customers.length > 5 ? <SearchBar value={query} onChangeText={setQuery} placeholder="Search your customers" /> : null}
          {shown.slice(0, 40).map((c, i) => (
            <Pressable
              key={c.person.id}
              onPress={() => { setCustomerId(c.person.id); setPropertyId(undefined); }}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{`${c.person.firstName} ${c.person.lastName}`.trim()}</Text>
                {c.person.email ? <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{c.person.email}</Text> : null}
              </View>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
          ))}
          {customers.length === 0 ? <InlineNotice icon="info" tone="info" text="No customers yet. Add the first one below." style={{ marginBottom: spacing.sm }} /> : null}
          <QuickAddCustomer onAdded={(id) => { setCustomerId(id); setPropertyId(undefined); }} />
        </>
      )}

      {customer ? (
        <>
          <Text style={[typeScale.overline, { color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>2 · PROPERTY</Text>
          <PropertyChoice customerId={customerId} propertyId={propertyId} onSelect={pick} />
          {!propertyId ? (
            <View style={{ gap: spacing.sm }}>
              <Input label="Property name (optional)" value={form.name} onChangeText={set('name')} placeholder="Oak Plaza" />
              <Input
                label="Street address"
                value={form.address}
                onChangeText={(text) => setForm((f) => ({ ...f, ...applyStreetInput(text, f) }))}
                placeholder="1 Oak St"
                textContentType="fullStreetAddress"
                autoComplete="street-address"
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Input label="City" value={form.city} onChangeText={set('city')} containerStyle={{ flex: 2 }} />
                <Input label="State" value={form.state} onChangeText={set('state')} containerStyle={{ flex: 1 }} autoCapitalize="characters" />
                <Input label="ZIP" value={form.zip} onChangeText={set('zip')} containerStyle={{ flex: 1 }} keyboardType="number-pad" />
              </View>
            </View>
          ) : null}
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginVertical: spacing.sm }]}>
            Saved once for this customer and shared with landscaping and Maintenance. Next you turn on plowing, shoveling or salting.
          </Text>
          <Button title="Save property" loading={saving} onPress={save} fullWidth />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 52 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
});
