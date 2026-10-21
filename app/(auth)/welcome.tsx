import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useCompanySlotOpen } from '@/hooks/useCompanySlot';
import { LegalModal } from '@/components/legal/LegalModal';
import type { LegalDoc } from '@/legal/legalContent';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { brand } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.55, 240);

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const canCreateCompany = useCompanySlotOpen();
  const insets = useSafeAreaInsets();
  // The legal pages open as a pop-up over this screen, so closing one lands exactly here.
  const [reading, setReading] = useState<LegalDoc['slug'] | null>(null);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + spacing['4xl'] }]}>
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/images/logo-full.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.hero}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary, textAlign: 'center' }]}>
            Welcome
          </Text>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Manage your landscaping business{'\n'}from anywhere
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: pressed ? colors.primaryDark : colors.primary }, pressed && styles.pressed]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={[typeScale.labelLarge, { color: '#FFFFFF' }]}>Sign In</Text>
            <Icon name="arrow-right" size={20} color="#FFFFFF" />
          </Pressable>

          {canCreateCompany && (
            <ChoiceCard
              icon="briefcase"
              title="Create a Company"
              subtitle="Start managing your business"
              onPress={() => router.push('/(auth)/create-company')}
            />
          )}

          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Joining a team, or a customer? Open the private link your employer texted you.
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
          Brighton Lawn + Landscape
        </Text>
        <View style={styles.legalRow}>
          <Text style={[typeScale.caption, { color: colors.primary }]} onPress={() => setReading('privacy')}>Privacy Policy</Text>
          <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{'  ·  '}</Text>
          <Text style={[typeScale.caption, { color: colors.primary }]} onPress={() => setReading('terms')}>Terms of Use</Text>
          <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{'  ·  '}</Text>
          <Text style={[typeScale.caption, { color: colors.primary }]} onPress={() => setReading('support')}>Support</Text>
        </View>
      </View>
      <LegalModal slug={reading} onClose={() => setReading(null)} />
    </View>
  );
}

/** White rounded card with a green icon circle, used for the secondary welcome choices. */
function ChoiceCard({ icon, title, subtitle, onPress }: {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: pressed ? colors.primary : colors.border },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: brand.primarySurface }]}>
        <Icon name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.btnTextGroup}>
        <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_WIDTH * 0.45,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  actions: {
    gap: spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextGroup: {
    flex: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  customerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
});
