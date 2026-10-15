import React from 'react';
import { SnowPlaceholder } from '@/components/snow/SnowPlaceholder';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsList';
import { ModeSwitchRow } from '@/components/snow/ModeSwitchRow';
import { useAuth } from '@/providers/AuthProvider';

export default function SnowOwnerMoreScreen() {
  const { signOut } = useAuth();
  return (
    <SnowPlaceholder
      title="More"
      icon="menu"
      purpose="Activity log, time corrections, customer media review and Snow Mode settings."
    >
      <SettingsGroup title="Mode">
        <ModeSwitchRow />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow icon="log-out" title="Sign Out" destructive onPress={signOut} />
      </SettingsGroup>
    </SnowPlaceholder>
  );
}
