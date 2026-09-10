import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Input, Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { useTeamCode } from '@/hooks/useOnboarding';

type Step = 'code' | 'account' | 'profile';

export default function JoinTeamScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAppState } = useAuth();
  const { validateCode } = useTeamCode();

  const [step, setStep] = useState<Step>('code');

  const [teamCode, setTeamCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [codeValid, setCodeValid] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleValidateCode() {
    const result = validateCode(teamCode.trim());
    if (result.valid) {
      setCodeValid(true);
      setCodeError('');
      setCompanyName(result.companyName ?? '');
    } else {
      setCodeValid(false);
      setCodeError('Invalid team code. Please check and try again.');
    }
  }

  function handleCodeNext() {
    if (!codeValid) {
      handleValidateCode();
      return;
    }
    setStep('account');
  }

  function handleAccountNext() {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setStep('profile');
  }

  async function handlePickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      // On web, ImagePicker may not be fully supported — use a fallback
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            setPhotoUri(url);
          }
        };
        input.click();
      }
    }
  }

  async function handleSubmitRequest() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    if (!photoUri) {
      setError('A profile photo is required. Please add a clear photo of yourself.');
      return;
    }
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setAppState('pending_approval', {
      onboardingStep: 'pending_approval',
      pendingCompanyName: companyName,
      pendingRequestId: 'jr-new',
      pendingProfile: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        photoUri,
      },
    });
    setLoading(false);
  }

  function handleBack() {
    if (step === 'account') setStep('code');
    else if (step === 'profile') setStep('account');
    else router.back();
  }

  const stepNumber = step === 'code' ? 1 : step === 'account' ? 2 : 3;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
          Join a Team
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progressRow}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.progressDot, { backgroundColor: n <= stepNumber ? colors.primary : colors.borderLight }]} />
        ))}
      </View>
      <Text style={[typeScale.labelSmall, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg }]}>
        Step {stepNumber} of 3 — {step === 'code' ? 'Team Code' : step === 'account' ? 'Create Account' : 'Complete Profile'}
      </Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: semantic.errorLight }]}>
            <Feather name="alert-circle" size={16} color={semantic.error} />
            <Text style={[typeScale.bodySmall, { color: semantic.error, flex: 1, marginLeft: spacing.sm }]}>{error}</Text>
          </View>
        ) : null}

        {step === 'code' && (
          <View style={styles.form}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Enter the team code provided by your company. Ask your manager or team lead if you don't have one.
            </Text>
            <Input
              label="Team Code"
              placeholder="e.g. BRIGHTON-4821"
              value={teamCode}
              onChangeText={(v) => { setTeamCode(v.toUpperCase()); setCodeValid(false); setCodeError(''); }}
              autoCapitalize="characters"
              icon="hash"
            />
            {codeError ? (
              <View style={[styles.codeResult, { backgroundColor: semantic.errorLight, borderColor: semantic.error }]}>
                <Feather name="x-circle" size={16} color={semantic.error} />
                <Text style={[typeScale.bodySmall, { color: semantic.error, marginLeft: spacing.sm }]}>{codeError}</Text>
              </View>
            ) : null}
            {codeValid ? (
              <View style={[styles.codeResult, { backgroundColor: semantic.successLight, borderColor: semantic.success }]}>
                <Feather name="check-circle" size={16} color={semantic.success} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typeScale.bodySmall, { color: semantic.success, fontWeight: '600' }]}>Code verified!</Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>You're joining {companyName}</Text>
                </View>
              </View>
            ) : null}
            <Button
              title={codeValid ? 'Continue' : 'Verify Code'}
              onPress={codeValid ? handleCodeNext : handleValidateCode}
              fullWidth
              size="lg"
              icon={codeValid ? 'arrow-right' : 'check'}
            />
          </View>
        )}

        {step === 'account' && (
          <View style={styles.form}>
            <View style={[styles.companyBanner, { backgroundColor: colors.primarySurface }]}>
              <Feather name="briefcase" size={16} color={colors.primary} />
              <Text style={[typeScale.labelSmall, { color: colors.primary, marginLeft: spacing.sm }]}>
                Joining {companyName}
              </Text>
            </View>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              Create your account or sign in if you already have one.
            </Text>
            <Input label="Email *" placeholder="you@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail" />
            <Input label="Password *" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry icon="lock" />
            <Input label="Confirm Password *" placeholder="Re-enter password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry icon="lock" />
            <Button title="Next" onPress={handleAccountNext} fullWidth size="lg" icon="arrow-right" />
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center' }]}>
                Already have an account? <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign in instead</Text>
              </Text>
            </Pressable>
          </View>
        )}

        {step === 'profile' && (
          <View style={styles.form}>
            <View style={[styles.companyBanner, { backgroundColor: colors.primarySurface }]}>
              <Feather name="briefcase" size={16} color={colors.primary} />
              <Text style={[typeScale.labelSmall, { color: colors.primary, marginLeft: spacing.sm }]}>
                Joining {companyName}
              </Text>
            </View>

            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              Complete your profile so your team can identify you.
            </Text>

            <View style={styles.photoSection}>
              <Text style={[typeScale.labelSmall, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Profile Photo *
              </Text>
              <Pressable
                style={[
                  styles.photoUpload,
                  {
                    borderColor: photoUri ? colors.primary : colors.border,
                    backgroundColor: photoUri ? colors.primarySurface : colors.surface,
                  },
                ]}
                onPress={handlePickPhoto}
              >
                {photoUri ? (
                  <View style={styles.photoPlaceholder}>
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.photoImage}
                      contentFit="cover"
                    />
                    <View style={[styles.photoCheck, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Feather name="camera" size={32} color={colors.textTertiary} />
                    <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                      Add a clear photo of yourself
                    </Text>
                  </View>
                )}
              </Pressable>
              {photoUri && (
                <Pressable onPress={handlePickPhoto} style={{ alignSelf: 'center', marginTop: spacing.xs }}>
                  <Text style={[typeScale.caption, { color: colors.primary }]}>Change photo</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.row}>
              <Input label="First Name *" placeholder="John" value={firstName} onChangeText={setFirstName} containerStyle={{ flex: 1 }} />
              <Input label="Last Name *" placeholder="Smith" value={lastName} onChangeText={setLastName} containerStyle={{ flex: 1 }} />
            </View>
            <Input label="Phone *" placeholder="(555) 555-0100" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="phone" />

            <View style={[styles.infoBox, { backgroundColor: '#FFF8E1', borderColor: '#F9A825' }]}>
              <Feather name="info" size={14} color="#F9A825" />
              <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
                After submitting, the company owner will review your request. You'll be notified when approved.
              </Text>
            </View>

            <Button title="Submit Join Request" onPress={handleSubmitRequest} loading={loading} fullWidth size="lg" icon="send" />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xs,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  codeResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xs,
    borderLeftWidth: 3,
  },
  companyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoSection: {
    marginBottom: spacing.xs,
  },
  photoUpload: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: 116,
    height: 116,
    borderRadius: 58,
  },
  photoCheck: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.xs,
    borderLeftWidth: 3,
  },
});
