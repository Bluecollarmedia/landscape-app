import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function WorkerProfileScreen() {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer scrollable padded>
      <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.xl }}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Profile</Text>
      </View>
      <Card title="Account" style={{ marginBottom: spacing.lg }}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
          {user?.email}
        </Text>
      </Card>
      <Button title="Sign Out" onPress={signOut} variant="secondary" fullWidth icon="log-out" />
    </ScreenContainer>
  );
}
