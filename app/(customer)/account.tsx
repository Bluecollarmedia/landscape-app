import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function CustomerAccountScreen() {
  const { colors } = useTheme();
  const { user, signOut, switchDevRole } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer scrollable padded>
      <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.xl }}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Account</Text>
      </View>
      <Card title="Profile" style={{ marginBottom: spacing.lg }}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
          {user?.email}
        </Text>
      </Card>

      <Card title="Your Company" style={{ marginBottom: spacing.lg }}>
        <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>
          Brighton Lawn + Landscape
        </Text>
        <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          (216) 555-0100
        </Text>
      </Card>

      <Card title="Dev Tools" subtitle="Switch between roles for testing" style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Owner" onPress={() => switchDevRole('owner')} variant={user?.role === 'owner' ? 'primary' : 'secondary'} style={{ flex: 1 }} />
          <Button title="Worker" onPress={() => switchDevRole('worker')} variant={user?.role === 'worker' ? 'primary' : 'secondary'} style={{ flex: 1 }} />
          <Button title="Customer" onPress={() => switchDevRole('customer')} variant={user?.role === 'customer' ? 'primary' : 'secondary'} style={{ flex: 1 }} />
        </View>
      </Card>

      <Button title="Sign Out" onPress={signOut} variant="secondary" fullWidth icon="log-out" />
    </ScreenContainer>
  );
}
