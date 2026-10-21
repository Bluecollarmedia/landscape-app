/**
 * Sign Up Screen — Brighton Lawn + Landscape
 *
 * Plain account creation (no company yet). Used by people the owner invited
 * by email: signing up with the invited email adds them to the company
 * automatically. Anyone else lands on "Finish setting up" afterwards.
 */

import { TermsAgreement, TERMS_REQUIRED_MESSAGE } from '@/components/legal/TermsAgreement';
import React, { useState, useRef } from 'react';
import { View, Text, Image, TextInput, StyleSheet, Pressable, Dimensions, Platform, Alert, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { SignupPhotoPicker } from '@/components/account/SignupPhotoPicker';
import { saveSignupPhoto } from '@/data/signupPhoto';
import { stashPendingSignup } from '@/data/pendingSignup';
import { Icon } from '@/components/ui/Icon';
import { semantic } from '@/theme/colors';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.45, 200);

export default function SignUpScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [agreed, setAgreed] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);


  async function handleSignUp() {
    if (!agreed) {
      setError(TERMS_REQUIRED_MESSAGE);
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError('');
    Keyboard.dismiss();
    setLoading(true);

    try {
      const result = await signUp(email.trim(), password, { firstName: firstName.trim(), lastName: lastName.trim() });
      // The photo is optional and can only be saved once signed in. A problem with it never undoes the account.
      if (photoUri && !result.needsEmailConfirmation) {
        const saved = await saveSignupPhoto(photoUri);
        if (!saved.ok) {
          const note = `Your account is ready, but your profile photo wasn't saved. ${saved.error} You can add it by tapping your name in Settings.`;
          if (Platform.OS === 'web') alert(note);
          else Alert.alert('Photo not saved', note);
        }
      }
      if (result.needsEmailConfirmation) {
        // Not signed in yet, so the photo can't be saved now: keep it on the phone and save it when they first sign in.
        await stashPendingSignup({ email: email.trim(), photoUri });
        const msg = `We sent a confirmation link to ${email.trim()}. Open it, then sign in.${photoUri ? ' Your photo is saved and will be added then.' : ''}`;
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Check your email', msg);
        router.replace('/(auth)/login');
      }
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
      contentStyle={{ ...styles.content, paddingTop: insets.top + spacing.lg }}
    >
      {/* Logo */}
      <View style={styles.logoSection}>
        <Image
          source={require('../../assets/images/logo-icon.png')}
          style={styles.logoIcon}
          resizeMode="contain"
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
          Create your account
        </Text>
        <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          Invited by your company? Use the email they invited.
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

        <SignupPhotoPicker uri={photoUri} onChange={setPhotoUri} onError={setError} firstName={firstName} lastName={lastName} />

        <View style={styles.nameRow}>
          <Input
            label="First name"
            placeholder="First"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => lastNameRef.current?.focus()}
            containerStyle={styles.nameInput}
            icon="user"
          />
          <Input
            ref={lastNameRef}
            label="Last name"
            placeholder="Last"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            containerStyle={styles.nameInput}
          />
        </View>

        <Input
          ref={emailRef}
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
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleSignUp}
          icon="lock"
        />

        <TermsAgreement value={agreed} onChange={(v) => { setAgreed(v); if (v) setError(''); }} />

        <Button
          title="Create Account"
          onPress={handleSignUp}
          loading={loading}
          fullWidth
          size="lg"
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign in</Text>
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
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  logoIcon: {
    width: 64,
    height: 64,
  },
  header: {
    marginBottom: spacing['2xl'],
  },
  form: {
    gap: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameInput: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
});
