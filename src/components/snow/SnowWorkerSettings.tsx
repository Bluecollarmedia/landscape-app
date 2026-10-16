/**
 * Snow worker Settings: who you're signed in as, which snow services the
 * owner has given you, and Sign Out. Read-only on purpose: the services come
 * from the owner (get_my_snow_access, update 020), so there is nothing here
 * to change and no owner controls. Working layout, no approved mockup yet.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, InlineNotice } from '@/components/ui';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsList';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { db, useDb } from '@/data/store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SNOW_SERVICE_ICONS, SNOW_SERVICE_LABELS, type SnowService } from '@/types/snowProperty';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface MySnowAccess {
  companyName?: string;
  services: SnowService[];
  alsoLandscaping: boolean;
}

/** This person's snow access at their company, or null while loading / when it can't be read. */
function useMySnowAccess(companyId?: string | null) {
  const [access, setAccess] = useState<MySnowAccess | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !companyId) return;
    let alive = true;
    supabase.rpc('get_my_snow_access').then(({ data, error: err }) => {
      if (!alive) return;
      const rows = !err && Array.isArray(data)
        ? (data as { company_id?: string; company_name?: string; services?: string[]; landscaping_access?: boolean }[])
        : null;
      const mine = rows?.find((r) => r.company_id === companyId);
      if (!mine) return setError(true);
      setError(false);
      setAccess({
        companyName: mine.company_name,
        services: (mine.services ?? []).filter((s): s is SnowService => s in SNOW_SERVICE_LABELS),
        alsoLandscaping: mine.landscaping_access !== false,
      });
    });
    return () => { alive = false; };
  }, [companyId]);

  return { access, error };
}

export function SnowWorkerSettings() {
  useDb();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { user, signOut } = useAuth();
  const { access, error } = useMySnowAccess(db.companyId);

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginBottom: spacing.lg }]}>Settings</Text>

        <View style={[styles.profile, { backgroundColor: colors.surface }]}>
          <Avatar firstName={user?.firstName ?? 'W'} lastName={user?.lastName ?? 'K'} size={56} uri={user?.avatarUrl} />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]} numberOfLines={1}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>{user?.email}</Text>
            {access?.companyName ? (
              <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>{access.companyName}</Text>
            ) : null}
          </View>
        </View>

        {error ? (
          <InlineNotice icon="alert-circle" tone="warning" text="Couldn't load your snow team access. Pull to refresh or try again later." style={{ marginBottom: spacing.xl }} />
        ) : null}

        {access ? (
          <SettingsGroup
            title="Your snow services"
            footer="The owner decides which services you work. Ask them if one is missing."
          >
            {access.services.length ? access.services.map((s) => (
              <SettingsRow key={s} icon={SNOW_SERVICE_ICONS[s]} title={SNOW_SERVICE_LABELS[s]} />
            )) : (
              <SettingsRow icon="info" title="No services assigned yet" subtitle="The owner hasn't given you a snow service." />
            )}
            {access.alsoLandscaping ? (
              <SettingsRow icon="sun" title="Landscaping" subtitle="You also have access to the landscaping app." />
            ) : null}
          </SettingsGroup>
        ) : null}

        <SettingsGroup>
          <SettingsRow icon="log-out" title="Sign Out" destructive onPress={signOut} />
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, marginBottom: spacing.xl },
});
