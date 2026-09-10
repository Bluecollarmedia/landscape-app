import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import type { AppState } from '@/providers/AuthProvider';
import { Card, Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { mockCompany } from '@/data/mock';
import type { UserRole } from '@/types';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user, signOut, switchDevRole, switchDevState, appState } = useAuth();
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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card title="Your Account" style={styles.card}>
          <SettingRow icon="user" label="Name" value={`${user?.firstName} ${user?.lastName}`} colors={colors} />
          <SettingRow icon="mail" label="Email" value={user?.email ?? '—'} colors={colors} />
          <SettingRow icon="shield" label="Role" value="Owner" colors={colors} />
        </Card>

        <Card title="Company" style={styles.card}>
          <SettingRow icon="briefcase" label="Name" value={mockCompany.name} colors={colors} />
          <SettingRow icon="phone" label="Phone" value={mockCompany.phone ?? '—'} colors={colors} />
          <SettingRow icon="mail" label="Email" value={mockCompany.email ?? '—'} colors={colors} />
          <SettingRow
            icon="map-pin"
            label="Address"
            value={`${mockCompany.address}, ${mockCompany.city}, ${mockCompany.state} ${mockCompany.zip}`}
            colors={colors}
          />
        </Card>

        <Card title="Team & Joining" style={styles.card}>
          <Pressable
            style={[styles.menuLink, { borderBottomColor: colors.borderLight }]}
            onPress={() => router.push('/(owner)/more/join-settings' as any)}
          >
            <Feather name="user-plus" size={16} color={colors.primary} />
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
              Join Settings
            </Text>
            <Feather name="chevron-right" size={16} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            style={styles.menuLink}
            onPress={() => router.push('/(owner)/more/pending-requests' as any)}
          >
            <Feather name="inbox" size={16} color={colors.primary} />
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
              Pending Requests
            </Text>
            <Feather name="chevron-right" size={16} color={colors.textTertiary} />
          </Pressable>
        </Card>

        <Card title="Storage & Security" style={styles.card}>
          <Pressable
            style={[styles.menuLink, { borderBottomColor: colors.borderLight }]}
            onPress={() => router.push('/(owner)/more/storage' as any)}
          >
            <Feather name="hard-drive" size={16} color={colors.primary} />
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
              Storage Usage
            </Text>
            <Feather name="chevron-right" size={16} color={colors.textTertiary} />
          </Pressable>
        </Card>

        <Card title="App" style={styles.card}>
          <SettingRow icon="info" label="Version" value="1.0.0 (Phase 9)" colors={colors} />
          <SettingRow icon="database" label="Backend" value="Mock data (Supabase not configured)" colors={colors} />
        </Card>

        <Card title="Dev Tools" style={styles.card}>
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Switch between roles and states for testing
          </Text>
          <View style={styles.devRow}>
            {devStates.map((item) => {
              const isActive =
                (item.role && appState === 'active' && user?.role === item.role) ||
                (!item.role && appState === item.state);
              return (
                <Pressable
                  key={item.label}
                  style={[
                    styles.devBtn,
                    { borderColor: colors.border },
                    isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => handleDevSwitch(item)}
                >
                  <Text
                    style={[
                      typeScale.labelSmall,
                      { color: isActive ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Button
          title="Sign Out"
          onPress={signOut}
          variant="secondary"
          fullWidth
          icon="log-out"
        />
      </ScrollView>
    </View>
  );
}

function SettingRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={styles.settingRow}>
      <Feather name={icon as any} size={16} color={colors.textTertiary} />
      <Text style={[typeScale.caption, { color: colors.textTertiary, width: 65 }]}>{label}</Text>
      <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1 }]}>{value}</Text>
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
  card: { marginBottom: spacing.lg },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  menuLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  devBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
