import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { Card, Button, Avatar } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { ScreenContainer } from '@/components/layout';
import type { NavAppPreference } from '@/types/worker';

const NAV_OPTIONS: { value: NavAppPreference; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'google_maps', label: 'Google Maps', icon: 'map' },
  { value: 'apple_maps', label: 'Apple Maps', icon: 'compass' },
  { value: 'waze', label: 'Waze', icon: 'navigation' },
  { value: 'default', label: 'System Default', icon: 'smartphone' },
];

export default function WorkerSettingsScreen() {
  const { colors } = useTheme();
  const { user, signOut, switchDevRole } = useAuth();
  const insets = useSafeAreaInsets();
  const { settings, updateNavApp } = useWorkerContext();

  return (
    <ScreenContainer scrollable padded>
      <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.xl }}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Settings</Text>
      </View>

      <Card title="Profile" style={styles.section}>
        <View style={styles.profileRow}>
          <Avatar firstName={user?.firstName ?? ''} lastName={user?.lastName ?? ''} size={56} uri={user?.avatarUrl} />
          <View style={{ marginLeft: spacing.md }}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
            {user?.phone && (
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                {user.phone}
              </Text>
            )}
          </View>
        </View>
      </Card>

      <Card title="Navigation App" subtitle="Choose which maps app opens for directions" style={styles.section}>
        {NAV_OPTIONS.map(opt => (
          <Pressable
            key={opt.value}
            style={[
              styles.navOption,
              {
                backgroundColor: settings.navApp === opt.value ? colors.primarySurface : 'transparent',
                borderColor: settings.navApp === opt.value ? colors.primary : colors.borderLight,
              },
            ]}
            onPress={() => updateNavApp(opt.value)}
          >
            <Feather name={opt.icon} size={20} color={settings.navApp === opt.value ? colors.primary : colors.textSecondary} />
            <Text style={[
              typeScale.bodyMedium,
              {
                color: settings.navApp === opt.value ? colors.primary : colors.textPrimary,
                marginLeft: spacing.sm, flex: 1,
              },
            ]}>
              {opt.label}
            </Text>
            {settings.navApp === opt.value && (
              <Feather name="check" size={18} color={colors.primary} />
            )}
          </Pressable>
        ))}
      </Card>

      <Card title="App Info" style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Version</Text>
          <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>1.0.0 (Phase 5)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Role</Text>
          <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{user?.role}</Text>
        </View>
      </Card>

      <Card title="Dev Tools" subtitle="Switch between roles for testing" style={styles.section}>
        <View style={styles.devRow}>
          <Button
            title="Owner"
            onPress={() => switchDevRole('owner')}
            variant={user?.role === 'owner' ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
          />
          <Button
            title="Worker"
            onPress={() => switchDevRole('worker')}
            variant={user?.role === 'worker' ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
          />
          <Button
            title="Customer"
            onPress={() => switchDevRole('customer')}
            variant={user?.role === 'customer' ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Button
        title="Sign Out"
        onPress={signOut}
        variant="secondary"
        fullWidth
        icon="log-out"
        style={{ marginTop: spacing.md }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  devRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
