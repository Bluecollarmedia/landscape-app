/**
 * Snow Settings (owner/admin). Everything here does something real:
 *  - Stop rule: the database refuses to finish a stop that was never "I'm Here"-ed
 *    when this is on.
 *  - Alerts: the owner's "stop finished" alert (company-wide setting).
 *  - Team, properties, customer photos, activity and hours: the screens where those
 *    things are actually managed, grouped so they can be found.
 *  - Your profile and Mode.
 * No decorative toggles: anything that is not wired to behavior is not listed.
 */
import { LegalSection } from '@/components/legal/LegalSection';
import { DeleteAccountRow } from '@/components/account/DeleteAccountRow';
import { ListSection } from '@/components/ui';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassIconButton, InlineNotice, Switch } from '@/components/ui';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsList';
import { ModeSwitchRow } from '@/components/snow/ModeSwitchRow';
import { OwnerStopAlertsToggle } from '@/components/snow/notifications/SnowNotifySettings';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { db, useDb } from '@/data/store';
import { ARRIVAL_OFF_WARNING, loadSnowRules, setRequireArrival } from '@/data/snowSettings';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

export function SnowSettingsScreen() {
  useDb();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const companyId = db.companyId;
  const [requireArrival, setRequire] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    loadSnowRules(companyId).then((r) => {
      if (!alive) return;
      if (r.ok) { setRequire(r.data.requireArrival); setError(null); } else setError(r.error);
    });
    return () => { alive = false; };
  }, [companyId]);

  async function save(next: boolean) {
    if (!companyId) return;
    const before = requireArrival;
    setRequire(next);
    setSaving(true);
    const res = await setRequireArrival(companyId, next);
    setSaving(false);
    if (!res.ok) { setRequire(before); setError(res.error); } else setError(null);
  }

  function change(next: boolean) {
    if (next) return save(true);
    // Turning the rule off changes what the crew can do, so it is confirmed first.
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (m: string) => boolean }).confirm?.(`Turn off "I'm Here" rule?\n\n${ARRIVAL_OFF_WARNING}`)) save(false);
      return;
    }
    Alert.alert("Turn off the \"I'm Here\" rule?", ARRIVAL_OFF_WARNING, [
      { text: 'Keep it on', style: 'cancel' },
      { text: 'Turn off', style: 'destructive', onPress: () => save(false) },
    ]);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <GlassIconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>Snow Settings</Text>
        <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginBottom: spacing.xl }]}>Rules, alerts and where to manage your team</Text>

        <SettingsGroup
          title="Stop rule"
          footer="When this is on, the database will not let a stop be finished until the lead has tapped I'm Here at the property."
        >
          <View style={[styles.toggleRow, { backgroundColor: colors.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>Require I'm Here first</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                {requireArrival === null ? 'Loading…' : requireArrival ? 'On: leads must arrive before finishing a stop' : "Off: a stop can be finished without I'm Here"}
              </Text>
            </View>
            <Switch value={!!requireArrival} disabled={requireArrival === null || saving || !companyId} onValueChange={change} accessibilityLabel="Require I'm Here first" />
          </View>
          {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ margin: spacing.md }} /> : null}
        </SettingsGroup>

        {companyId ? (
          <SettingsGroup title="Alerts">
            <OwnerStopAlertsToggle companyId={companyId} />
          </SettingsGroup>
        ) : null}

        <SettingsGroup title="Team and access" footer="Give existing workers snow access, approve new ones, and share the Snow signup code.">
          <SettingsRow icon="users" title="Snow team" subtitle="Members, requests and the signup code" onPress={() => router.push('/snow/owner/team-list' as any)} />
        </SettingsGroup>

        <SettingsGroup title="Customers and properties" footer="Add an existing customer's property from Properties → From a customer. Customers see snow updates only for properties linked to them.">
          <SettingsRow icon="home" title="Properties" subtitle="Services, contacts and instructions" onPress={() => router.push('/snow/owner/properties-list' as any)} />
          <SettingsRow icon="camera" title="Customer photo updates" subtitle="Approve photos before customers see them" onPress={() => router.push('/snow/owner/review')} />
        </SettingsGroup>

        <SettingsGroup title="Records">
          <SettingsRow icon="activity" title="Activity log" subtitle="Everything that happened, by storm, route and person" onPress={() => router.push('/snow/owner/activity')} />
          <SettingsRow icon="clock" title="Snow hours" subtitle="Hours by worker and storm; fix a missed clock-out" onPress={() => router.push('/snow/owner/hours')} />
        </SettingsGroup>

        <SettingsGroup title="Storms" footer="Delete a storm you made by mistake, or one that is finished and no longer wanted. Not shown on the dashboard.">
          <SettingsRow icon="trash-2" title="Manage storms" subtitle="Delete any storm, even an ended one" onPress={() => router.push('/snow/owner/manage-storms' as any)} />
        </SettingsGroup>

        <SettingsGroup title="You">
          <SettingsRow icon="user" title="Your profile and photo" onPress={() => router.push('/snow/owner/edit-profile' as any)} />
          <ModeSwitchRow />
        </SettingsGroup>

        <LegalSection />

        <SettingsGroup>
          <SettingsRow icon="log-out" title="Sign Out" destructive onPress={signOut} />
        </SettingsGroup>
        <ListSection>
          <DeleteAccountRow />
        </ListSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
});
