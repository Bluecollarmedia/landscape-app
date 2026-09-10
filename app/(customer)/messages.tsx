import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { ScreenContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function CustomerMessagesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer scrollable padded>
      <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.xl }}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Messages</Text>
      </View>
      <EmptyState
        icon="message-circle"
        title="No messages"
        description="Communicate with your landscaping team here."
      />
    </ScreenContainer>
  );
}
