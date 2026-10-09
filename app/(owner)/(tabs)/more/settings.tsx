import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { AppState } from '@/providers/AuthProvider';
import { ListSection, ListRow } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { db, useDb } from '@/data/store';
import type { UserRole } from '@/types';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user, signOut, switchDevRole, switchDevState, appState } = useAuth();
  useDb();
  const company = db.company;
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ListSection title="Your Account">
          <ListRow icon="user" title="Name" value={`${user?.firstName} ${user?.lastName}`} />
          <ListRow icon="mail" title="Email" value={user?.email ?? '—'} />
          <ListRow icon="shield" title="Role" value="Owner" />
        </ListSection>

        <ListSection title="Company">
          <ListRow icon="briefcase" title="Name" value={company?.name ?? '—'} />
          <ListRow icon="phone" title="Phone" value={company?.phone || '—'} />
          <ListRow icon="mail" title="Email" value={company?.email || '—'} />
          <ListRow
            icon="map-pin"
            title="Address"
            subtitle={[company?.address, company?.city, [company?.state, company?.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}
          />
          {!db.demo && (
            <>
              <ListRow
                icon="image"
                iconColor={colors.primary}
                title="Company Info & Dashboard Photo"
                showChevron
                onPress={() => router.push({ pathname: '/(owner)/setup', params: { step: 'company' } } as any)}
              />
              <ListRow
                icon="check-square"
                iconColor={colors.primary}
                title="Recommended Setup"
                showChevron
                onPress={() => router.push('/(owner)/setup' as any)}
              />
            </>
          )}
        </ListSection>

        <ListSection title="Team & Joining">
          <ListRow
            icon="user-plus"
            iconColor={colors.primary}
            title="Join Settings"
            showChevron
            onPress={() => router.push('/(owner)/more/join-settings' as any)}
          />
          <ListRow
            icon="inbox"
            iconColor={colors.primary}
            title="Pending Requests"
            showChevron
            onPress={() => router.push('/(owner)/more/pending-requests' as any)}
          />
        </ListSection>

        <ListSection title="Storage & Security">
          <ListRow
            icon="hard-drive"
            iconColor={colors.primary}
            title="Storage Usage"
            showChevron
            onPress={() => router.push('/(owner)/more/storage' as any)}
          />
        </ListSection>

        <ListSection title="App">
          <ListRow icon="info" title="Version" value="1.0.0" />
          <ListRow icon="database" title="Backend" subtitle={isSupabaseConfigured ? 'Supabase (live data)' : 'Mock data (Supabase not configured)'} />
        </ListSection>

        {!isSupabaseConfigured && (
          <ListSection title="Dev Tools" footer="Switch between roles and states for testing — hidden once the app is connected to a real backend">
            {devStates.map((item) => {
              const isActive =
                (item.role && appState === 'active' && user?.role === item.role) ||
                (!item.role && appState === item.state);
              return (
                <ListRow
                  key={item.label}
                  title={item.label}
                  selected={isActive}
                  onPress={() => handleDevSwitch(item)}
                />
              );
            })}
          </ListSection>
        )}

        <ListSection>
          <ListRow icon="log-out" iconColor={colors.error} title="Sign Out" destructive onPress={signOut} />
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
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: { padding: spacing.xs },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },
});
