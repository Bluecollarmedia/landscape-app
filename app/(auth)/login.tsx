/**
 * Login Screen — Brighton Lawn + Landscape
 *
 * Clean, professional login with the full company logo.
 */

import React, { useState, useRef } from 'react';
import { View, Text, Image, TextInput, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.55, 240);

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRef = useRef<TextInput>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer
      scrollable
      padded
      keyboardAvoiding
      contentStyle={styles.content}
    >
      {/* Back to welcome */}
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Icon name="arrow-left" size={20} color={colors.textSecondary} />
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>Back</Text>
      </Pressable>

      {/* Logo */}
      <View style={styles.logoSection}>
        <Image
          source={require('../../assets/images/logo-full.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Welcome text */}
      <View style={styles.header}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
          Welcome back
        </Text>
        <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          Sign in to your account
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: semantic.errorLight }]}>
            <Icon name="alert-circle" size={16} color={semantic.error} />
            <Text style={[typeScale.bodySmall, { color: semantic.error, flex: 1, marginLeft: spacing.sm }]}>{error}</Text>
          </View>
        ) : null}

        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          icon="mail"
        />

        <Input
          ref={passwordRef}
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          icon="lock"
        />

        <Button
          title="Sign In"
          onPress={handleLogin}
          loading={loading}
          fullWidth
          size="lg"
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable onPress={() => router.replace('/(auth)/welcome')}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Get started</Text>
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    paddingTop: spacing['3xl'],
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_WIDTH * 0.45,
  },
  header: {
    marginBottom: spacing['2xl'],
  },
  form: {
    gap: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
});
