import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { Button, Input, Card } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic, brand } from '@/theme/colors';
import { useCustomerAccess } from '@/hooks/useCustomerAccess';

type Step = 'enter_code' | 'code_valid' | 'authenticate' | 'claiming' | 'success';

export default function CustomerAccessScreen() {
  const { colors } = useTheme();
  const { signIn, signUp, switchDevRole } = useAuth();
  const router = useRouter();
  const { validateCode, claimProject, isLoading } = useCustomerAccess();

  const [step, setStep] = useState<Step>('enter_code');
  const [code, setCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  async function handleValidateCode() {
    if (!code.trim()) {
      setError('Please enter your project code.');
      return;
    }

    setError('');
    const result = await validateCode(code);

    if (result.valid) {
      setProjectName(result.projectName);
      setProjectId(result.projectId);
      setStep('code_valid');
    } else {
      switch (result.error) {
        case 'invalid_code':
          setError('Invalid project code. Please check the code and try again.');
          break;
        case 'already_claimed':
          setError('This project has already been claimed. If this is your project, sign in with your email instead.');
          break;
        case 'portal_disabled':
          setError('The customer portal is not enabled for this project. Contact your landscaping company.');
          break;
      }
    }
  }

  async function handleAuthenticate() {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setAuthLoading(true);

    try {
      // In mock mode, simulate claiming as a new customer
      switchDevRole('customer');
      setStep('claiming');

      const result = await claimProject(code, 'customer1');
      if (result.success) {
        setStep('success');
      } else {
        setError('Failed to claim project. Please try again.');
        setStep('authenticate');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed. Please try again.');
      setStep('authenticate');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleContinueToProjects() {
    router.replace('/(customer)');
  }

  function renderEnterCode() {
    return (
      <>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: brand.primarySurface }]}>
            <Feather name="key" size={28} color={colors.primary} />
          </View>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>
            Project Access
          </Text>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Enter the project code provided by your landscaping company
          </Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: semantic.errorLight }]}>
              <Feather name="alert-circle" size={16} color={semantic.error} />
              <Text style={[typeScale.bodySmall, { color: semantic.error, marginLeft: spacing.sm, flex: 1 }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <Input
            label="Project Code"
            placeholder="e.g. BEACH142"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleValidateCode}
            icon="hash"
          />

          <Button
            title="Verify Code"
            onPress={handleValidateCode}
            loading={isLoading}
            fullWidth
            size="lg"
          />
        </View>
      </>
    );
  }

  function renderCodeValid() {
    return (
      <>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: semantic.successLight }]}>
            <Feather name="check-circle" size={28} color={semantic.success} />
          </View>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>
            Project Found
          </Text>
        </View>

        <Card style={styles.projectCard}>
          <View style={styles.projectInfo}>
            <Feather name="layers" size={20} color={colors.primary} />
            <Text style={[typeScale.headingMedium, { color: colors.textPrimary, marginLeft: spacing.md, flex: 1 }]}>
              {projectName}
            </Text>
          </View>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            To access this project, sign in or create an account with your email address.
            This will permanently link the project to your account.
          </Text>
        </Card>

        <View style={styles.form}>
          <Button
            title="Continue to Sign In"
            onPress={() => { setError(''); setStep('authenticate'); }}
            fullWidth
            size="lg"
          />
          <Button
            title="Use a Different Code"
            onPress={() => { setStep('enter_code'); setCode(''); setError(''); }}
            variant="secondary"
            fullWidth
            size="lg"
          />
        </View>
      </>
    );
  }

  function renderAuthenticate() {
    return (
      <>
        <View style={styles.header}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
            Sign In
          </Text>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Sign in to claim access to{' '}
            <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{projectName}</Text>
          </Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: semantic.errorLight }]}>
              <Feather name="alert-circle" size={16} color={semantic.error} />
              <Text style={[typeScale.bodySmall, { color: semantic.error, marginLeft: spacing.sm, flex: 1 }]}>
                {error}
              </Text>
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
            onSubmitEditing={handleAuthenticate}
            icon="lock"
          />

          <Button
            title="Sign In & Claim Project"
            onPress={handleAuthenticate}
            loading={authLoading}
            fullWidth
            size="lg"
          />

          <Button
            title="Back"
            onPress={() => { setStep('code_valid'); setError(''); }}
            variant="secondary"
            fullWidth
            size="lg"
          />
        </View>
      </>
    );
  }

  function renderClaiming() {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' }]}>
          Claiming your project...
        </Text>
      </View>
    );
  }

  function renderSuccess() {
    return (
      <>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: semantic.successLight }]}>
            <Feather name="check-circle" size={36} color={semantic.success} />
          </View>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>
            You're All Set
          </Text>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            You now have access to <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{projectName}</Text>.
            You can sign in anytime with your email — no project code needed.
          </Text>
        </View>

        <View style={styles.form}>
          <Button
            title="View My Projects"
            onPress={handleContinueToProjects}
            fullWidth
            size="lg"
          />
        </View>
      </>
    );
  }

  const stepRenderers: Record<Step, () => React.ReactNode> = {
    enter_code: renderEnterCode,
    code_valid: renderCodeValid,
    authenticate: renderAuthenticate,
    claiming: renderClaiming,
    success: renderSuccess,
  };

  return (
    <ScreenContainer scrollable padded keyboardAvoiding contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Feather name="arrow-left" size={20} color={colors.textSecondary} />
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
          Back
        </Text>
      </Pressable>

      {stepRenderers[step]()}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing['3xl'],
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
  },
  projectCard: {
    marginBottom: spacing.xl,
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
});
