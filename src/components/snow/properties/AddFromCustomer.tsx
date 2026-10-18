/**
 * "Add from an existing customer" (Snow Properties). Pick a customer you already
 * have, pick one of their known addresses (landscaping projects and maintenance
 * properties), and it becomes a Snow property linked to their app account.
 * Nothing about the customer is typed again and no second account is made.
 * If a Snow property is already at that address, it is reused, not duplicated.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Button, Icon, InlineNotice, SearchBar } from '@/components/ui';
import { confirmAction, showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { db, rowsOf, useDb } from '@/data/store';
import { addCustomerPlaceToSnow } from '@/data/snowExisting';
import {
  customersToOffer, findSnowPropertyAt, knownPlacesFor, snowNameFor, type KnownPlace, type SnowPropertyLike,
} from '@/lib/snowExisting';
import { formatAddress } from '@/lib/address';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface Props {
  snowProperties: (SnowPropertyLike)[];
  onCancel: () => void;
  /** Called with the Snow property to open next (new, or the one that already existed). */
  onDone: (propertyId: string) => void;
}

export function AddFromCustomer({ snowProperties, onCancel, onDone }: Props) {
  const { colors } = useTheme();
  const version = useDb();
  const [query, setQuery] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const customers = useMemo(
    () => customersToOffer(db.members),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const customer = customers.find((c) => c.personId === personId);
  const places = useMemo(
    () => (personId ? knownPlacesFor(personId, db.projects, rowsOf('maintenance_properties') as { id: string }[]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personId, version],
  );

  const q = query.trim().toLowerCase();
  const shown = q
    ? customers.filter((c) => `${c.person!.firstName} ${c.person!.lastName} ${c.person!.email ?? ''}`.toLowerCase().includes(q))
    : customers;

  async function add(place: KnownPlace) {
    if (!customer || busy) return;
    const existing = findSnowPropertyAt(place.address, place.zip, snowProperties);
    const person = customer.person!;
    const who = `${person.firstName} ${person.lastName}`.trim() || person.email || 'this customer';
    const run = async () => {
      setBusy(true);
      const res = await addCustomerPlaceToSnow({
        companyId: db.companyId,
        customer: { personId: customer.personId, firstName: person.firstName, lastName: person.lastName, email: person.email, phone: person.phone },
        place,
        propertyName: snowNameFor(place, person.lastName),
        existingPropertyId: existing?.id,
      });
      setBusy(false);
      if (!res.ok) {
        showMessage("Couldn't finish", res.propertyId
          ? `${res.error}\n\nThe Snow property was made. Try again and it will only add the customer link.`
          : res.error);
        if (res.propertyId) onDone(res.propertyId);
        return;
      }
      if (!res.linkedCustomer) showMessage('Already linked', `${who} was already linked to this property.`);
      onDone(res.propertyId);
    };

    if (existing) {
      confirmAction(
        'Already a Snow property',
        `"${existing.name}" is already at ${place.address}. Link ${who} to it instead of making a second one?`,
        'Link and open',
        run,
      );
    } else {
      confirmAction(
        'Add to Snow?',
        `This makes a Snow property at ${formatAddress(place)} and links ${who}'s app account, so they can see it. No new customer or account is created. You choose the services next.`,
        'Add to Snow',
        run,
      );
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]}>
          {customer ? `${customer.person!.firstName} ${customer.person!.lastName}`.trim() : 'Pick a customer'}
        </Text>
        <Button title={customer ? 'Back' : 'Cancel'} size="sm" variant="ghost" onPress={() => (customer ? setPersonId(null) : onCancel())} />
      </View>

      {!customer ? (
        <>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search your customers" />
          {customers.length === 0 ? (
            <InlineNotice icon="info" tone="info" text="No customers yet. Add a customer first (More → Customers), then come back." style={{ marginTop: spacing.md }} />
          ) : shown.length === 0 ? (
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.md }]}>No customer matches.</Text>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              {shown.slice(0, 50).map((c, i) => (
                <Pressable
                  key={c.personId}
                  onPress={() => setPersonId(c.personId)}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{c.person!.firstName} {c.person!.lastName}</Text>
                    {c.person!.email ? <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{c.person!.email}</Text> : null}
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                </Pressable>
              ))}
              {shown.length > 50 ? <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>Showing 50. Search to narrow it down.</Text> : null}
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={[typeScale.overline, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs }]}>THEIR PROPERTIES</Text>
          {places.length === 0 ? (
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              No address on file for this customer yet. Use Add (the regular form) and link them under "Customer app account" on the property.
            </Text>
          ) : places.map((p, i) => {
            const onSnow = findSnowPropertyAt(p.address, p.zip, snowProperties);
            return (
              <Pressable
                key={`${p.source}:${p.sourceId}`}
                onPress={() => add(p)}
                disabled={busy}
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }, busy && { opacity: 0.5 }]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{formatAddress(p)}</Text>
                  <Text style={[typeScale.caption, { color: onSnow ? colors.primary : colors.textTertiary }]}>
                    {onSnow ? 'Already a Snow property. Tap to link this customer' : p.source === 'project' ? 'From a landscaping project' : 'From a maintenance property'}
                  </Text>
                </View>
                <Icon name="plus-circle" size={20} color={colors.primary} />
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 52 },
});
