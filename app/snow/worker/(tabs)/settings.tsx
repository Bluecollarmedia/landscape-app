import React from 'react';
import { SnowPlaceholder } from '@/components/snow/SnowPlaceholder';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsList';
import { useAuth } from '@/providers/AuthProvider';

export default function Screen() {
  const { signOut } = useAuth();
  return (
    <SnowPlaceholder title="Settings" icon="settings" purpose="Your profile and snow team details.">
      <SettingsGroup>
        <SettingsRow icon="log-out" title="Sign Out" destructive onPress={signOut} />
      </SettingsGroup>
    </SnowPlaceholder>
  );
}
