import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { DeleteAccountRow } from '@/components/account/DeleteAccountRow';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { semantic } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.45, 200);

export default function DeclinedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, pendingCompanyName, pendingKind } = useAuth();
  const isSnow = pendingKind === 'snow';

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
          <View style={[styles.iconCircle, { backgroundColor: semantic.errorLight }]}>
            <Icon name="x-circle" size={32} color={semantic.error} />
          </View>

          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }]}>
            Request Not Approved
          </Text>

          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 }]}>
            Your request to join {isSnow ? 'the snow team at ' : ''}{pendingCompanyName ?? 'the company'} was not approved. If you believe this is a mistake, please contact the company directly.
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          title={isSnow ? 'Enter a New Snow Code' : 'Enter a New Team Code'}
          onPress={() => router.push((isSnow ? '/(auth)/join-team?kind=snow' : '/(auth)/join-team') as any)}
          variant="secondary"
          icon="hash"
          fullWidth
        />
        <Button title="Sign Out" onPress={signOut} variant="ghost" icon="log-out" fullWidth />
        <DeleteAccountRow />
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
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
  },
});
