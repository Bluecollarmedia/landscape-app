/**
 * Owner: how the customer of one maintenance property gets in. The customer gets a private one-time link
 * (supabase/updates/078_invite_links.sql) and, once signed up, sees this property's finished visits and the photos you share.
 * "Remove access" unlinks them from the property.
 */
import React, { useState } from 'react';
import { Alert, Platform, View, Text } from 'react-native';
import { ListSection, ListRow } from '@/components/ui';
import { CustomerInviteCard } from '@/components/invites/CustomerInviteCard';
import { isSupabaseConfigured } from '@/lib/supabase';
import { regenerateMaintenanceCode } from '@/data/maintenanceCodes';
import { useTheme } from '@/providers/ThemeProvider';
import { haptics } from '@/lib/haptics';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

function confirmThen(title: string, msg: string, action: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (confirm(msg)) run();
  } else {
    Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: run }]);
  }
}

function tell(title: string, msg: string) {
  if (Platform.OS === 'web') alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export function CustomerAccessSection({ propertyId, customer }: {
  propertyId: string;
  /** The customer linked to this property, if any. */
  customer?: { id: string; firstName: string; phone?: string };
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  async function removeAccess() {
    setBusy(true);
    const res = await regenerateMaintenanceCode(propertyId, true);
    setBusy(false);
    if (!res.ok) return tell('Couldn’t remove access', res.error);
    haptics.success();
  }

  return (
    <ListSection title="CUSTOMER LOGIN">
      <View style={{ padding: spacing.md }}>
        {customer ? (
          <CustomerInviteCard personId={customer.id} firstName={customer.firstName} phone={customer.phone} />
        ) : (
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Link a customer to this property to send them a login link.</Text>
        )}
      </View>
      {customer && isSupabaseConfigured && (
        <ListRow
          icon="user-x"
          title="Remove Customer’s Access"
          subtitle="Unlinks the customer from this property"
          destructive
          onPress={() => confirmThen(
            'Remove access?',
            'The customer will no longer see this property’s visits or photos.',
            'Remove',
            () => { if (!busy) removeAccess(); },
          )}
        />
      )}
    </ListSection>
  );
}
