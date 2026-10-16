import React from 'react';
import { SnowPlaceholder } from '@/components/snow/SnowPlaceholder';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsList';
import { ModeSwitchRow } from '@/components/snow/ModeSwitchRow';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function SnowOwnerMoreScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  return (
    <SnowPlaceholder
      title="More"
      icon="menu"
      purpose="Activity log, time corrections, customer media review and Snow Mode settings."
    >
      <SettingsGroup title="Records">
        <SettingsRow
          icon="activity"
          title="Activity log"
          subtitle="Everything that happened, by storm, route and person"
          onPress={() => router.push('/snow/owner/activity')}
        />
      </SettingsGroup>
      <SettingsGroup title="Mode">
        <ModeSwitchRow />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow icon="log-out" title="Sign Out" destructive onPress={signOut} />
      </SettingsGroup>
    </SnowPlaceholder>
  );
}
