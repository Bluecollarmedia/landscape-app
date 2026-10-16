import React from 'react';
import { SnowPlaceholder } from '@/components/snow/SnowPlaceholder';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsList';
import { ModeSwitchRow } from '@/components/snow/ModeSwitchRow';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { db, useDb } from '@/data/store';
import { OwnerStopAlertsToggle } from '@/components/snow/notifications/SnowNotifySettings';

export default function SnowOwnerMoreScreen() {
  useDb();
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
        <SettingsRow
          icon="clock"
          title="Snow hours"
          subtitle="Who clocked in this week, and fix a missed clock-out"
          onPress={() => router.push('/snow/owner/hours')}
        />
        <SettingsRow
          icon="camera"
          title="Photo review"
          subtitle="Approve photos and send updates to customers"
          onPress={() => router.push('/snow/owner/review')}
        />
      </SettingsGroup>
      {db.companyId ? (
        <SettingsGroup title="Alerts">
          <OwnerStopAlertsToggle companyId={db.companyId} />
        </SettingsGroup>
      ) : null}
      <SettingsGroup title="Mode">
        <ModeSwitchRow />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow icon="log-out" title="Sign Out" destructive onPress={signOut} />
      </SettingsGroup>
    </SnowPlaceholder>
  );
}
