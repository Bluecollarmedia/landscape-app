import { TermsAgreement, TERMS_REQUIRED_MESSAGE } from '@/components/legal/TermsAgreement';
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Alert, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Input, Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { useTeamCode } from '@/hooks/useOnboarding';
import { lookupSnowCode, requestSnowAccess } from '@/hooks/useSnowOnboarding';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/media';
import { saveBirthdayForCurrentUser } from '@/data/birthday';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { parseBirthday, birthdayProblem, birthdayInputText } from '@/lib/birthday';
import { DateField } from '@/components/ui/DateField';
import { localDateKey } from '@/lib/ids';

type Step = 'code' | 'account' | 'profile';

/** Same screen for the landscaping team code and the separate Snow code
 * (`?kind=snow`). A Snow code only files a Snow access request. */

export default function JoinTeamScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAppState, signUp, isAuthenticated, user, refreshContext } = useAuth();
  const { validateCode: validateTeamCode } = useTeamCode();
  const isSnow = useLocalSearchParams<{ kind?: string }>().kind === 'snow';
  const validateCode = isSnow ? lookupSnowCode : validateTeamCode;
  const codeLabel = isSnow ? 'Snow Code' : 'Team Code';
  // Already signed in (came from "Finish setting up"): skip the account step.
  const signedIn = isSupabaseConfigured && isAuthenticated && !!user;

  const [step, setStep] = useState<Step>('code');

  const [teamCode, setTeamCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [joiningAsMaintenance, setJoiningAsMaintenance] = useState(false);
  const [codeValid, setCodeValid] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [birthday, setBirthday] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleValidateCode() {
    const result = await validateCode(teamCode.trim());
    if (result.valid) {
      setCodeValid(true);
      setCodeError('');
      setCompanyName(result.companyName ?? '');
      setJoiningAsMaintenance('workerType' in result && result.workerType === 'maintenance');
    } else {
      setCodeValid(false);
      setCodeError(`Invalid ${codeLabel.toLowerCase()}. Please check and try again.`);
    }
  }

  function handleCodeNext() {
    if (!codeValid) {
      handleValidateCode();
      return;
    }
    setStep(signedIn ? 'profile' : 'account');
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

  const photo = useProfilePhoto(setPhotoUri, setError);
  const handlePickPhoto = () => photo.pick('library');

  const [agreed, setAgreed] = useState(false);

  async function handleSubmitRequest() {
    if (!signedIn && !agreed) {
      setError(TERMS_REQUIRED_MESSAGE);
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    const birthdayErr = birthdayProblem(birthday);
    if (birthdayErr) {
      setError(`Birthday: ${birthdayErr}`);
      return;
    }
    setError('');
    Keyboard.dismiss();
    setLoading(true);

    if (!isSupabaseConfigured) {
      // Demo mode: no backend, just show the pending screen.
      await new Promise((r) => setTimeout(r, 800));
      setAppState('pending_approval', {
        onboardingStep: 'pending_approval',
        pendingCompanyName: companyName,
        pendingRequestId: 'jr-new',
        pendingKind: isSnow ? 'snow' : 'team',
      });
      setLoading(false);
      return;
    }

    try {
      const profile = { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() };
      if (signedIn && isSnow) {
        const res = await requestSnowAccess(teamCode);
        if (!res.ok) throw new Error(res.error);
        await supabase.from('people').update({
          first_name: profile.firstName, last_name: profile.lastName, phone: profile.phone,
        }).eq('id', user!.id);
      } else if (signedIn) {
        const { data, error: rpcError } = await supabase.rpc('request_join', { p_code: teamCode.trim() });
        if (rpcError) throw rpcError;
        const result = data as { success: boolean; error?: string };
        if (!result?.success) {
          throw new Error(result?.error === 'already_member' ? "You're already on this team." : 'That team code no longer works. Ask your manager for a new one.');
        }
        await supabase.from('people').update({
          first_name: profile.firstName, last_name: profile.lastName, phone: profile.phone,
        }).eq('id', user!.id);
      } else {
        const result = await signUp(email.trim(), password, profile, isSnow ? { snowCode: teamCode.trim() } : { teamCode: teamCode.trim() });
        if (result.needsEmailConfirmation) {
          const msg = `We sent a confirmation link to ${email.trim()}. Open it, then sign in. Your request to join ${isSnow ? `the ${companyName} snow team` : companyName} has been sent.`;
          if (Platform.OS === 'web') alert(msg);
          else Alert.alert('Check your email', msg);
          router.replace('/(auth)/login');
          return;
        }
      }

      // Birthday is optional. Saved now when we are signed in; when an email confirmation comes first it can be added later in Edit Profile.
      const birthdayIso = parseBirthday(birthday);
      if (birthdayIso) await saveBirthdayForCurrentUser(birthdayIso);

      // Profile photo is optional; upload it if one was picked.
      if (photoUri) {
        try {
          const { data: ctx } = await supabase.rpc('get_my_context');
          const personId = (ctx as { person?: { id: string } } | null)?.person?.id;
          if (personId) {
            const { url } = await uploadImage(photoUri, `avatars/${personId}`);
            await supabase.from('people').update({ avatar_url: url }).eq('id', personId);
          }
        } catch (photoErr) {
          console.warn('[join-team] profile photo upload failed', photoErr);
          // Sign-up itself worked; say why the photo didn't, and where to add it again.
          const why = photoErr instanceof Error ? photoErr.message : 'Unknown error';
          const note = `Your request was sent, but your profile photo wasn't saved. ${why} You can add it later in Settings → Edit Profile.`;
          if (Platform.OS === 'web') alert(note);
          else Alert.alert('Photo not saved', note);
        }
      }

      await refreshContext();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (step === 'account') setStep('code');
    else if (step === 'profile') setStep(signedIn ? 'code' : 'account');
    else router.back();
  }

  const stepNumber = step === 'code' ? 1 : step === 'account' ? 2 : 3;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
          {isSnow ? 'Join the Snow Team' : 'Join a Team'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progressRow}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.progressDot, { backgroundColor: n <= stepNumber ? colors.primary : colors.borderLight }]} />
        ))}
      </View>
      <Text style={[typeScale.labelSmall, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg }]}>
        Step {stepNumber} of 3 — {step === 'code' ? codeLabel : step === 'account' ? 'Create Account' : 'Complete Profile'}
      </Text>

      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: semantic.errorLight }]}>
            <Icon name="alert-circle" size={16} color={semantic.error} />
            <Text style={[typeScale.bodySmall, { color: semantic.error, flex: 1, marginLeft: spacing.sm }]}>{error}</Text>
          </View>
        ) : null}

        {step === 'code' && (
          <View style={styles.form}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              {isSnow
                ? 'Enter the Snow code from the owner. It sends a request; you get snow access only after the owner approves it.'
                : "Enter the team code provided by your company. Ask your manager or team lead if you don't have one."}
            </Text>
            <Input
              label={codeLabel}
              placeholder={isSnow ? 'e.g. SNOW-7KQ4HM' : 'e.g. BRIGHTON-4821'}
              value={teamCode}
              onChangeText={(v) => { setTeamCode(v.toUpperCase()); setCodeValid(false); setCodeError(''); }}
              autoCapitalize="characters"
              icon="hash"
            />
            {codeError ? (
              <View style={[styles.codeResult, { backgroundColor: semantic.errorLight, borderColor: semantic.error }]}>
                <Icon name="x-circle" size={16} color={semantic.error} />
                <Text style={[typeScale.bodySmall, { color: semantic.error, marginLeft: spacing.sm }]}>{codeError}</Text>
              </View>
            ) : null}
            {codeValid ? (
              <View style={[styles.codeResult, { backgroundColor: semantic.successLight, borderColor: semantic.success }]}>
                <Icon name="check-circle" size={16} color={semantic.success} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typeScale.bodySmall, { color: semantic.success, fontWeight: '600' }]}>Code verified!</Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                    {isSnow
                      ? `You're asking to join the ${companyName} snow team. The owner approves your request first.`
                      : `You're joining ${companyName}${joiningAsMaintenance ? ' as a maintenance worker' : ''}. The owner approves your request first.`}
                  </Text>
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
              <Icon name="briefcase" size={16} color={colors.primary} />
              <Text style={[typeScale.labelSmall, { color: colors.primary, marginLeft: spacing.sm }]}>
                Joining {companyName}{isSnow ? ' (Snow)' : ''}
              </Text>
            </View>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              Create your account or sign in if you already have one.
            </Text>
            <Input label="Email *" placeholder="you@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail" />
            <Input label="Password *" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" autoCorrect={false} icon="lock" />
            <Input label="Confirm Password *" placeholder="Re-enter password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" autoCorrect={false} icon="lock" />
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
              <Icon name="briefcase" size={16} color={colors.primary} />
              <Text style={[typeScale.labelSmall, { color: colors.primary, marginLeft: spacing.sm }]}>
                Joining {companyName}{isSnow ? ' (Snow)' : ''}
              </Text>
            </View>

            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              Complete your profile so your team can identify you.
            </Text>

            <View style={styles.photoSection}>
              <Text style={[typeScale.labelSmall, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Profile Photo (optional)
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
                      <Icon name="check" size={12} color="#FFFFFF" />
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Icon name="camera" size={32} color={colors.textTertiary} />
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
            <DateField label="Birthday (optional)" icon="gift" placeholder="Select your birthday" value={parseBirthday(birthday) ?? ''} onChange={(k) => setBirthday(birthdayInputText(k))} onClear={() => setBirthday('')} maximumDate={localDateKey(new Date())} initialPickerDate="1990-01-01" />

            <View style={[styles.infoBox, { backgroundColor: semantic.warningLight, borderColor: semantic.warning }]}>
              <Icon name="info" size={14} color={semantic.warning} />
              <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
                After submitting, the company owner will review your request. You'll be notified when approved.
              </Text>
            </View>

            {!signedIn && <TermsAgreement value={agreed} onChange={(v) => { setAgreed(v); if (v) setError(''); }} />}

            <Button title={isSnow ? 'Submit Snow Request' : 'Submit Join Request'} onPress={handleSubmitRequest} loading={loading} fullWidth size="lg" icon="send" />
          </View>
        )}
      </KeyboardAwareScrollView>
      {photo.cropper}
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
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  codeResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
  },
  companyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
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
    borderRadius: radius.md,
    borderLeftWidth: 3,
  },
});
