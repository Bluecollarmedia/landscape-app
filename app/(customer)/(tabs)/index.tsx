import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePortfolioEnabled } from '@/hooks/usePortfolio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { AnnouncementBanner } from '@/components/customer/AnnouncementBanner';
import { WeatherButton } from '@/components/weather/WeatherButton';
import { PropertyHome } from '@/components/customerHome/PropertyHome';
import { useCustomerHome } from '@/hooks/useCustomerHome';
import { emptyPortalText } from '@/lib/customerPortal';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * The customer's home, one property at a time (see src/components/customerHome/PropertyHome.tsx): a chip per property, and inside a property
 * one tab each for Snow, Lawn and Project when it has more than one. Finished projects are tucked into "Past work".
 */
export default function CustomerHomeScreen() {
  const t = useT();
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const data = useCustomerHome();
  const router = useRouter();
  const workOn = usePortfolioEnabled();
  const empty = data.groups.length === 0 && data.past.length === 0;

  return (
    <ScreenContainer scrollable padded>
      <View style={{ paddingTop: insets.top + spacing.sm, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <WeatherButton to="/(customer)/weather" />
        <View style={{ flexShrink: 1 }}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{t('Welcome Back')}</Text>
          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, fontWeight: '800' }]}>{user?.firstName ?? 'there'}</Text>
        </View>
      </View>

      <AnnouncementBanner />

      {workOn ? (
        <Pressable
          onPress={() => router.push('/(customer)/work' as any)}
          accessibilityRole="button"
          accessibilityLabel={t('Our Work')}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md }, pressed && { opacity: 0.85 }]}
        >
          <MaterialCommunityIcons name="image-multiple-outline" size={26} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]}>{t('Our Work')}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{t('See the projects and reels we have done')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      {empty ? (
        <EmptyState icon="layers" title={t(emptyPortalText().title)} description={t(emptyPortalText().description)} />
      ) : (
        <PropertyHome data={data} />
      )}
    </ScreenContainer>
  );
}
