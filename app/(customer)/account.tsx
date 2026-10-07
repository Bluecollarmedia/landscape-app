import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { Avatar, ListSection, ListRow } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { mockCompany } from '@/data/mock';

export default function CustomerAccountScreen() {
  const { colors } = useTheme();
  const { user, signOut, switchDevRole } = useAuth();
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
      </ListSection>

      <ListSection title="Your Company">
        <ListRow icon="briefcase" title={mockCompany.name} />
        <ListRow icon="phone" title="Phone" value={mockCompany.phone ?? '—'} />
      </ListSection>

      {__DEV__ && (
        <ListSection title="Dev Tools" footer="Switch between roles for testing — not shown in production builds">
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
      </ListSection>
    </ScreenContainer>
  );
}
