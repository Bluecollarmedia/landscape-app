import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface SnowPlaceholderProps {
  title: string;
  /** What this screen will be for, in a sentence. */
  purpose: string;
  icon: string;
  /** Extra content under the placeholder (e.g. settings rows). */
  children?: React.ReactNode;
}

/**
 * Stand-in for a Snow Mode screen whose layout hasn't been designed yet.
 * Each one is replaced by the real screen built from its approved mockup.
 */
export function SnowPlaceholder({ title, purpose, icon, children }: SnowPlaceholderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: tabBarClearance + spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modeChip}>
          <Icon name="cloud-snow" size={13} color={colors.primary} />
          <Text style={[typeScale.labelSmall, { color: colors.primary }]}>Snow Mode</Text>
        </View>
        <Text style={[typeScale.displaySmall, styles.title, { color: colors.textPrimary }]} accessibilityRole="header">
          {title}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySurface }]}>
            <Icon name={icon as any} size={26} color={colors.primary} />
          </View>
          <Text style={[typeScale.bodyLarge, styles.purpose, { color: colors.textSecondary }]}>{purpose}</Text>
          <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
            This screen is being designed.
          </Text>
        </View>

        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: spacing.xs },
  title: { marginTop: spacing.xs, marginBottom: spacing.lg, marginLeft: spacing.xs },
  card: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  purpose: { textAlign: 'center', marginBottom: spacing.sm },
});
