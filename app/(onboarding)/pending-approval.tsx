import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.45, 200);

export default function PendingApprovalScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut, pendingCompanyName, user, refreshContext } = useAuth();
  const [checking, setChecking] = useState(false);

  // Look for an approval every so often, so the app moves on by itself once
  // the owner approves (no need to sign out and back in).
  useEffect(() => {
    const timer = setInterval(() => { refreshContext().catch(() => {}); }, 15000);
    return () => clearInterval(timer);
  }, [refreshContext]);

  async function handleCheckAgain() {
    setChecking(true);
    try {
      await refreshContext();
    } finally {
      setChecking(false);
    }
  }

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

        <View style={[styles.statusCard, { backgroundColor: colors.surface }, shadow.sm]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySurface }]}>
            <Icon name="clock" size={32} color={colors.primary} />
          </View>

          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }]}>
            Request Submitted
          </Text>

          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Waiting for approval from
          </Text>
          <Text style={[typeScale.bodyLarge, { color: colors.primary, fontWeight: '600', textAlign: 'center' }]}>
            {pendingCompanyName ?? 'your company'}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.infoRow}>
            <Icon name="bell" size={16} color={colors.textTertiary} />
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
              We'll notify you when your account has been approved.
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="shield" size={16} color={colors.textTertiary} />
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
              Your information is secure and only visible to the company administrator.
            </Text>
          </View>
        </View>

        {user && (
          <View style={[styles.profileSummary, { backgroundColor: colors.surface }, shadow.sm]}>
            <Text style={[typeScale.overline, { color: colors.textTertiary }]}>YOUR REQUEST</Text>
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '500', marginTop: spacing.xs }]}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{user.email}</Text>
          </View>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button title="Check Again" onPress={handleCheckAgain} loading={checking} variant="secondary" icon="refresh-cw" fullWidth />
        <Button title="Sign Out" onPress={signOut} variant="ghost" icon="log-out" fullWidth />
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
    marginBottom: spacing['2xl'],
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_WIDTH * 0.45,
  },
  statusCard: {
    padding: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  profileSummary: {
    padding: spacing.lg,
    borderRadius: radius.sm,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
});
