import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { SnowDashboard } from '@/components/snow/SnowDashboard';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * Standalone route for the Snow dashboard so it can be opened and tested
 * before Snow Mode's own tabs render it (app/snow/owner/(tabs)/index.tsx on
 * the mode-switch branch is meant to show <SnowDashboard /> instead).
 */
export default function SnowDashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>Snow Dashboard</Text>
      </View>
      <SnowDashboard bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm },
});
