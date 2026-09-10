import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { brand } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.55, 240);

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Feather name="log-in" size={20} color="#FFFFFF" />
            <Text style={[typeScale.labelLarge, { color: '#FFFFFF', marginLeft: spacing.sm }]}>
              Sign In
            </Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryBtn, { backgroundColor: brand.primarySurface, borderColor: colors.primary }]}
            onPress={() => router.push('/(auth)/create-company')}
          >
            <Feather name="briefcase" size={20} color={colors.primary} />
            <View style={styles.btnTextGroup}>
              <Text style={[typeScale.labelLarge, { color: colors.primary }]}>
                Create a Company
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                Start managing your business
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(auth)/join-team')}
          >
            <Feather name="users" size={20} color={brand.accent} />
            <View style={styles.btnTextGroup}>
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>
                Join a Team
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                Enter your team code or invitation
              </Text>
            </View>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
            <Text style={[typeScale.caption, { color: colors.textTertiary, marginHorizontal: spacing.md }]}>
              or
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
          </View>

          <Pressable
            style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(auth)/customer-access' as any)}
          >
            <Feather name="eye" size={20} color={brand.accent} />
            <View style={styles.btnTextGroup}>
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>
                Customer Project Access
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                Enter your project code to view progress
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
          Brighton Lawn + Landscape
        </Text>
      </View>
    </View>
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
    paddingVertical: spacing.lg,
    borderRadius: radius.sm,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.md,
  },
  btnTextGroup: {
    flex: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
});
