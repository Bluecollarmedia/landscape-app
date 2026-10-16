import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/ui/Icon';
import { Avatar, GlassIconButton } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { DeleteAccountRow } from '@/components/account/DeleteAccountRow';
import { ModeSwitchRow } from '@/components/snow/ModeSwitchRow';
import { SettingsGroup, SettingsRow, PressScale, UsageBar, tileColors } from '@/components/settings/SettingsList';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useAuth } from '@/providers/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { AppState } from '@/providers/AuthProvider';
import { ListSection } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { brand } from '@/theme/colors';
import { db, useDb } from '@/data/store';
import { documentDefaults } from '@/data/financials';
import { useCompanyYard } from '@/hooks/useCompanyYard';
import { useStorageInfo, useStorageLimit } from '@/hooks/useStorage';
import { formatAddress } from '@/lib/address';
import { formatBytes, storageLimitLabel } from '@/types/storage';
import type { UserRole } from '@/types';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const tabBarClearance = useTabBarClearance();
  const { user, signOut, switchDevRole, switchDevState, appState } = useAuth();
  useDb();
  const company = db.company;
  const { yard } = useCompanyYard();
  const { info } = useStorageInfo();
  const { limitGb, limitBytes } = useStorageLimit();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const usedBytes = info?.usage.totalBytes ?? 0;
  const usedPercent = limitBytes > 0 ? Math.round((usedBytes / limitBytes) * 100) : 0;
  const usageColor = usedPercent > 90 ? tileColors.red : usedPercent > 75 ? tileColors.orange : colors.primary;
  const companyAddress = [company?.address, company?.city, [company?.state, company?.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  const docDefaults = documentDefaults();
  const docDefaultsSummary = [
    docDefaults.taxRate ? `${docDefaults.taxRate}% tax` : 'No tax',
    'terms, exclusions and payment instructions',
  ].join(' · ');

  const devStates: { label: string; state: AppState; role?: UserRole }[] = [
    { label: 'Owner', state: 'active', role: 'owner' },
    { label: 'Worker', state: 'active', role: 'worker' },
    { label: 'Customer', state: 'active', role: 'customer' },
    { label: 'Welcome', state: 'unauthenticated' },
    { label: 'Pending', state: 'pending_approval' },
    { label: 'Declined', state: 'declined' },
  ];

  function handleDevSwitch(item: typeof devStates[0]) {
    if (item.role) {
      switchDevRole(item.role);
    } else {
      switchDevState(item.state);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <GlassIconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Go back" />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typeScale.displaySmall, styles.title, { color: colors.textPrimary }]}>Settings</Text>

        <LinearGradient
          colors={[brand.primary, brand.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, shadow.md]}
        >
          <View style={styles.heroAvatarRing}>
            <Avatar firstName={user?.firstName ?? 'O'} lastName={user?.lastName ?? ''} size={60} uri={user?.avatarUrl} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.headingLarge, { color: '#FFFFFF' }]} numberOfLines={1}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={[typeScale.bodySmall, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <Icon name="shield" size={12} color="#FFFFFF" />
                <Text style={[typeScale.labelSmall, { color: '#FFFFFF' }]}>Owner</Text>
              </View>
              {!!company?.name && (
                <View style={[styles.heroChip, { flexShrink: 1 }]}>
                  <Icon name="briefcase" size={12} color="#FFFFFF" />
                  <Text style={[typeScale.labelSmall, { color: '#FFFFFF', flexShrink: 1 }]} numberOfLines={1}>
                    {company.name}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        <SettingsGroup title="Account">
          <SettingsRow
            icon="camera"
            tint={tileColors.green}
            title="Edit Profile & Photo"
            subtitle="Your name, phone and picture"
            onPress={() => router.push('/(owner)/edit-profile' as any)}
          />
        </SettingsGroup>

        <SettingsGroup title="Company">
          {!db.demo && (
            <SettingsRow
              icon="briefcase"
              tint={tileColors.green}
              title="Company Info & Header Photos"
              subtitle={[company?.phone, company?.email].filter(Boolean).join(' · ') || 'Name, phone, email, photos'}
              onPress={() => router.push({ pathname: '/(owner)/setup', params: { step: 'company' } } as any)}
            />
          )}
          {db.demo && (
            <SettingsRow icon="briefcase" tint={tileColors.green} title={company?.name ?? 'Company'} subtitle={companyAddress || undefined} />
          )}
          {!db.demo && !!companyAddress && (
            <SettingsRow icon="map-pin" tint={tileColors.pink} title="Office Address" subtitle={companyAddress} />
          )}
          <SettingsRow
            icon="navigation"
            tint={tileColors.blue}
            title="Yard Location"
            subtitle={yard ? formatAddress(yard) : 'Not set yet'}
            onPress={() => router.push('/(owner)/more/yard-location' as any)}
          />
          {!db.demo && (
            <SettingsRow
              icon="check-square"
              tint={tileColors.indigo}
              title="Recommended Setup"
              subtitle="Trucks, workers, pay rates and more"
              onPress={() => router.push('/(owner)/setup' as any)}
            />
          )}
        </SettingsGroup>

        <SettingsGroup title="Mode" footer="Snow Mode gives you and your snow crew the snow dashboard. Landscaping records stay as they are.">
          <ModeSwitchRow />
        </SettingsGroup>

        <SettingsGroup title="Quotes & Invoices">
          <SettingsRow
            icon="file-text"
            tint={tileColors.orange}
            title="Document Defaults"
            subtitle={docDefaultsSummary}
            onPress={() => router.push('/(owner)/more/document-defaults' as any)}
          />
        </SettingsGroup>

        <SettingsGroup title="Storage">
          <SettingsRow
            icon="hard-drive"
            tint={tileColors.teal}
            title="Storage"
            onPress={() => router.push('/(owner)/more/storage' as any)}
          >
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 1, marginBottom: spacing.xs + 2 }]}>
              {limitBytes > 0
                ? `${formatBytes(usedBytes)} of ${storageLimitLabel(limitGb)} used`
                : `${formatBytes(usedBytes)} used`}
            </Text>
            <UsageBar percent={limitBytes > 0 ? usedPercent : 0} color={usageColor} />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="App">
          <SettingsRow icon="info" tint={tileColors.gray} title="Version" value="1.0.0" />
          <SettingsRow
            icon="database"
            tint={tileColors.gray}
            title="Backend"
            subtitle={isSupabaseConfigured ? 'Supabase (live data)' : 'Mock data (Supabase not configured)'}
          />
        </SettingsGroup>

        {!isSupabaseConfigured && (
          <SettingsGroup title="Dev Tools" footer="Switch between roles and states for testing — hidden once the app is connected to a real backend">
            {devStates.map((item) => {
              const isActive =
                (item.role && appState === 'active' && user?.role === item.role) ||
                (!item.role && appState === item.state);
              return (
                <SettingsRow
                  key={item.label}
                  title={item.label}
                  selected={!!isActive}
                  onPress={() => handleDevSwitch(item)}
                />
              );
            })}
          </SettingsGroup>
        )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { marginBottom: spacing.lg, marginLeft: spacing.xs },
  scrollContent: { paddingHorizontal: spacing.lg },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl + 4,
    marginBottom: spacing.xl,
  },
  heroAvatarRing: {
    padding: 3,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  heroChips: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
