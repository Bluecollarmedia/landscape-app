/**
 * Owner: the customer code for one maintenance property. Share it with the
 * customer; they enter it under "Customer? View your project" and see this
 * property's finished visits and the photos you share. Regenerating the code
 * stops the old one working; "Remove access" also unlinks the customer.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ListSection, ListRow } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { loadMaintenanceCode, regenerateMaintenanceCode } from '@/data/maintenanceCodes';
import { haptics } from '@/lib/haptics';

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

export function CustomerAccessSection({ propertyId, propertyName, linked }: {
  propertyId: string;
  propertyName: string;
  /** A customer is already linked to this property. */
  linked: boolean;
}) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await loadMaintenanceCode(propertyId);
    setCode(res.ok ? res.data : null);
  }, [propertyId]);
  useEffect(() => { if (isSupabaseConfigured) load(); }, [load]);

  if (!isSupabaseConfigured) return null;

  async function copy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    haptics.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!code) return;
    const message =
      `Your Brighton Lawn + Landscape customer code for ${propertyName}: ${code}\n` +
      `Open the app, tap “Customer? View your project” and enter the code.`;
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(message);
      tell('Copied', 'The message with your code is copied. Paste it into a text or email.');
    } else {
      await Share.share({ message });
    }
  }

  async function renew(revoke: boolean) {
    setBusy(true);
    const res = await regenerateMaintenanceCode(propertyId, revoke);
    setBusy(false);
    if (!res.ok) return tell('Couldn’t change the code', res.error);
    haptics.success();
    setCode(res.data);
  }

  return (
    <ListSection
      title="CUSTOMER ACCESS"
      footer="Give this code to the property's customer. They enter it under “Customer? View your project” when they sign up, then see their finished visits and the photos you share. No project needed."
    >
      <ListRow
        icon="key"
        title={code === undefined ? 'Loading…' : code ?? 'No code yet'}
        subtitle={copied ? 'Copied' : linked ? 'Customer code · a customer is linked' : 'Customer code · tap to copy'}
        onPress={code ? copy : undefined}
      />
      {!!code && <ListRow icon="share" title="Share Code" showChevron onPress={share} />}
      {!!code && (
        <ListRow
          icon="refresh-cw"
          title="Make a New Code"
          subtitle="The old code stops working"
          showChevron
          onPress={() => confirmThen(
            'Make a new code?',
            'The old code will stop working. A customer who is already linked keeps their access until you remove it.',
            'New Code',
            () => { if (!busy) renew(false); },
          )}
        />
      )}
      {linked && (
        <ListRow
          icon="user-x"
          title="Remove Customer’s Access"
          subtitle="Unlinks the customer and makes a new code"
          destructive
          onPress={() => confirmThen(
            'Remove access?',
            'The customer will no longer see this property’s visits or photos. A new code is made.',
            'Remove',
            () => { if (!busy) renew(true); },
          )}
        />
      )}
    </ListSection>
  );
}
