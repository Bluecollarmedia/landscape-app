import { useMyMaintenanceProperties } from '@/data/maintenanceCustomer';
import React from 'react';
import { View, Text, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { DeleteAccountRow } from '@/components/account/DeleteAccountRow';
import { useAuth } from '@/providers/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ScreenContainer } from '@/components/layout';
import { Avatar, ListSection, ListRow } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { db, useDb } from '@/data/store';
import { formatAddress } from '@/lib/address';
import { useHasSnow } from '@/hooks/useHasSnow';

export default function CustomerAccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, signOut, switchDevRole } = useAuth();
  useDb();
  const hasSnow = useHasSnow();
  const myMaintenance = useMyMaintenanceProperties();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer scrollable padded variant="grouped">
      <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.xl }}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Account</Text>
      </View>

      <ListSection>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}>
          <Avatar firstName={user?.firstName ?? ''} lastName={user?.lastName ?? ''} size={52} uri={user?.avatarUrl} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
          </View>
        </View>
        <ListRow
          icon="edit-2"
          iconColor={colors.primary}
          title="Edit profile & photo"
          subtitle="Your name, phone and picture"
          showChevron
          onPress={() => router.push('/(customer)/edit-profile' as any)}
        />
      </ListSection>

      {myMaintenance.length > 0 ? (
        <ListSection title="Maintenance">
          <ListRow
            icon="repeat"
            iconColor={colors.primary}
            title="Maintenance updates"
            subtitle="Recent visits to your property, with photos we've shared"
            showChevron
            onPress={() => router.push('/(customer)/maintenance-updates')}
          />
        </ListSection>
      ) : null}

      {hasSnow ? (
        <ListSection title="Snow">
          <ListRow
            icon="cloud-snow"
            iconColor={colors.primary}
            title="Snow updates"
            subtitle="Plowing, shoveling and salting at your property, with photos"
            showChevron
            onPress={() => router.push('/(customer)/snow-updates')}
          />
        </ListSection>
      ) : null}

      <ListSection title="Your Project Team">
        <ListRow
          icon="briefcase"
          title={db.company?.name ?? '—'}
          subtitle={db.company ? formatAddress({ address: db.company.address, city: db.company.city, state: db.company.state, zip: db.company.zip }) || undefined : undefined}
        />
        {db.company?.phone ? (
          <ListRow
            icon="phone"
            iconColor={colors.primary}
            title="Call"
            value={db.company.phone}
            showChevron
            onPress={() => Linking.openURL(`tel:${db.company!.phone!.replace(/[^\d+]/g, '')}`)}
          />
        ) : null}
        {db.company?.email ? (
          <ListRow
            icon="mail"
            iconColor={colors.primary}
            title="Email"
            value={db.company.email}
            showChevron
            onPress={() => Linking.openURL(`mailto:${db.company!.email}`)}
          />
        ) : null}
      </ListSection>

      {!isSupabaseConfigured && (
        <ListSection title="Dev Tools" footer="Switch between roles for testing — hidden once the app is connected to a real backend">
          <ListRow
            icon="briefcase"
            title="Owner"
            selected={user?.role === 'owner'}
            onPress={() => switchDevRole('owner')}
          />
          <ListRow
            icon="tool"
            title="Worker"
            selected={user?.role === 'worker'}
            onPress={() => switchDevRole('worker')}
          />
          <ListRow
            icon="user"
            title="Customer"
            selected={user?.role === 'customer'}
            onPress={() => switchDevRole('customer')}
          />
        </ListSection>
      )}

      <ListSection>
        <ListRow icon="log-out" iconColor={colors.error} title="Sign Out" destructive onPress={signOut} />
        <DeleteAccountRow />
      </ListSection>
    </ScreenContainer>
  );
}
