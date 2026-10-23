import { TermsAgreement, TERMS_REQUIRED_MESSAGE } from '@/components/legal/TermsAgreement';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Image, Dimensions, Alert, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Input, Button } from '@/components/ui';
import { SignupPhotoPicker } from '@/components/account/SignupPhotoPicker';
import { saveSignupPhoto } from '@/data/signupPhoto';
import { stashPendingSignup } from '@/data/pendingSignup';
import { AddressFields, missingAddressPart } from '@/components/ui/AddressFields';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.4, 180);

type Step = 'company' | 'owner' | 'review';

export default function CreateCompanyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { switchDevRole, signUp, isAuthenticated, user, refreshContext } = useAuth();
  // Already signed in (came from "Finish setting up"): skip the account step.
  const signedIn = isSupabaseConfigured && isAuthenticated && !!user;

  const [step, setStep] = useState<Step>('company');
  const scrollRef = useRef<any>(null);
  // Each step opens at the top.
  useEffect(() => { scrollRef.current?.scrollTo?.({ x: 0, y: 0, animated: false }); }, [step]);

  // Company info
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [companyZip, setCompanyZip] = useState('');

  // Owner info
  const [firstName, setFirstName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validateCompany() {
    if (!companyName.trim()) {
      setError('Please enter your company name.');
      return false;
    }
    if (companyPhone.replace(/\D/g, '').length < 10) {
      setError('Please enter the company phone number.');
      return false;
    }
    const missing = missingAddressPart({ address: companyAddress, city: companyCity, state: companyState, zip: companyZip });
    if (missing) {
      setError(missing);
      return false;
    }
    setError('');
    return true;
  }

  function validateOwner() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your full name.');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    setError('');
    return true;
  }

  function handleNext() {
    if (step === 'company' && validateCompany()) {
      setStep(signedIn ? 'review' : 'owner');
    } else if (step === 'owner' && validateOwner()) {
      setStep('review');
    }
  }

  function handleBack() {
    if (step === 'owner') setStep('company');
    else if (step === 'review') setStep(signedIn ? 'company' : 'owner');
    else router.back();
  }

  const [agreed, setAgreed] = useState(false);

  async function handleCreate() {
    if (!signedIn && !agreed) {
      setError(TERMS_REQUIRED_MESSAGE);
      return;
    }
    if (!isSupabaseConfigured) {
      // Demo mode: no backend, just show the owner screens.
      setLoading(true);
      await new Promise((r) => setTimeout(r, 800));
      switchDevRole('owner');
      setLoading(false);
      return;
    }

    const company = {
      name: companyName.trim(),
      phone: companyPhone.trim() || undefined,
      address: companyAddress.trim() || undefined,
      city: companyCity.trim() || undefined,
      state: companyState.trim() || undefined,
      zip: companyZip.trim() || undefined,
    };

    Keyboard.dismiss();
    setError('');
    setLoading(true);
    try {
      // The database allows only one company. Ask first, so the sign-up path
      // can't quietly make an account with no company when one already exists.
      const { data: slotOpen, error: slotError } = await supabase.rpc('company_slot_open');
      if (!slotError && slotOpen === false) {
        throw new Error('A company already exists. Ask the owner to send you a private invite link to join it.');
      }

      if (signedIn) {
        const { error: rpcError } = await supabase.rpc('create_company', {
          data: {
            company_name: company.name,
            company_phone: company.phone ?? '',
            company_address: company.address ?? '',
            company_city: company.city ?? '',
            company_state: company.state ?? '',
            company_zip: company.zip ?? '',
          },
        });
        if (rpcError) throw rpcError;
        await refreshContext();
        return;
      }

      const result = await signUp(
        email.trim(),
        password,
        { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() },
        { company: { ...company, email: email.trim() } },
      );
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
        // Not signed in yet: keep the photo on the phone and save it at first sign-in.
        await stashPendingSignup({ email: email.trim(), photoUri });
        const msg = `We sent a confirmation link to ${email.trim()}. Open it, then sign in. Your company is already set up.${photoUri ? ' Your photo is saved and will be added then.' : ''}`;
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Check your email', msg);
        router.replace('/(auth)/login');
      }
      // Otherwise the new session routes straight to the owner screens.
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const stepLabels: Record<Step, string> = {
    company: 'Company Details',
    owner: 'Your Information',
    review: 'Review & Create',
  };

  const stepNumber = step === 'company' ? 1 : step === 'owner' ? 2 : 3;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
          Create a Company
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[
              styles.progressDot,
              {
                backgroundColor: n <= stepNumber ? colors.primary : colors.borderLight,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[typeScale.labelSmall, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg }]}>
        Step {stepNumber} of 3 — {stepLabels[step]}
      </Text>

      <KeyboardAwareScrollView ref={scrollRef} bottomOffset={KEYBOARD_GAP} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: semantic.errorLight }]}>
            <Icon name="alert-circle" size={16} color={semantic.error} />
            <Text style={[typeScale.bodySmall, { color: semantic.error, flex: 1, marginLeft: spacing.sm }]}>{error}</Text>
          </View>
        ) : null}

        {step === 'company' && (
          <View style={styles.form}>
            <Input label="Company Name *" placeholder="e.g. Brighton Lawn + Landscape" value={companyName} onChangeText={setCompanyName} icon="briefcase" />
            <Input label="Company Phone *" placeholder="(555) 555-0100" value={companyPhone} onChangeText={setCompanyPhone} keyboardType="phone-pad" icon="phone" textContentType="telephoneNumber" />
            <AddressFields
              required
              value={{ address: companyAddress, city: companyCity, state: companyState, zip: companyZip }}
              onChange={(a) => { setCompanyAddress(a.address); setCompanyCity(a.city); setCompanyState(a.state); setCompanyZip(a.zip); }}
            />
            <Button title="Next" onPress={handleNext} fullWidth size="lg" icon="arrow-right" />
          </View>
        )}

        {step === 'owner' && (
          <View style={styles.form}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              You'll be the company owner with full administrative access.
            </Text>
            {!signedIn && <SignupPhotoPicker uri={photoUri} onChange={setPhotoUri} onError={setError} firstName={firstName} lastName={lastName} />}
            <View style={styles.row}>
              <Input label="First Name *" placeholder="Joey" value={firstName} onChangeText={setFirstName} containerStyle={{ flex: 1 }} />
              <Input label="Last Name *" placeholder="Angeloco" value={lastName} onChangeText={setLastName} containerStyle={{ flex: 1 }} />
            </View>
            <Input label="Email *" placeholder="you@company.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail" />
            <Input label="Phone *" placeholder="(555) 555-0100" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="phone" />
            <Input label="Password *" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" autoCorrect={false} icon="lock" />
            <Input label="Confirm Password *" placeholder="Re-enter password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" autoCorrect={false} icon="lock" />
            <Button title="Next" onPress={handleNext} fullWidth size="lg" icon="arrow-right" />
          </View>
        )}

        {step === 'review' && (
          <View style={styles.form}>
            <View style={styles.reviewCard}>
              <View style={[styles.reviewSection, { borderBottomColor: colors.borderLight }]}>
                <Text style={[typeScale.overline, { color: colors.textTertiary }]}>COMPANY</Text>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600', marginTop: spacing.xs }]}>
                  {companyName}
                </Text>
                {companyPhone ? <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{companyPhone}</Text> : null}
                {companyAddress ? (
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                    {companyAddress}, {companyCity}, {companyState} {companyZip}
                  </Text>
                ) : null}
              </View>
              <View style={styles.reviewSection}>
                <Text style={[typeScale.overline, { color: colors.textTertiary }]}>OWNER</Text>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600', marginTop: spacing.xs }]}>
                  {signedIn ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}` : `${firstName} ${lastName}`}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{signedIn ? user?.email : email}</Text>
                {!signedIn && <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{phone}</Text>}
                <View style={[styles.roleBadge, { backgroundColor: colors.primarySurface }]}>
                  <Icon name="shield" size={12} color={colors.primary} />
                  <Text style={[typeScale.caption, { color: colors.primary, fontWeight: '600', marginLeft: 4 }]}>
                    Company Owner
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.primarySurface, borderColor: colors.primary }]}>
              <Icon name="info" size={16} color={colors.primary} />
              <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
                As the company owner, you'll have full control over your team, projects, and settings. You can invite workers and customers after setup.
              </Text>
            </View>

            {!signedIn && <TermsAgreement value={agreed} onChange={(v) => { setAgreed(v); if (v) setError(''); }} />}

            <Button title="Create Company" onPress={handleCreate} loading={loading} fullWidth size="lg" icon="check-circle" />
          </View>
        )}
      </KeyboardAwareScrollView>
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  reviewCard: {
    gap: spacing.lg,
  },
  reviewSection: {
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
  },
});
