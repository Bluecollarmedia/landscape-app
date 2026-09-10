import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Input, Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.4, 180);

type Step = 'company' | 'owner' | 'review';

export default function CreateCompanyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { switchDevRole } = useAuth();

  const [step, setStep] = useState<Step>('company');

  // Company info
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [companyZip, setCompanyZip] = useState('');

  // Owner info
  const [firstName, setFirstName] = useState('');
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
      setStep('owner');
    } else if (step === 'owner' && validateOwner()) {
      setStep('review');
    }
  }

  function handleBack() {
    if (step === 'owner') setStep('company');
    else if (step === 'review') setStep('owner');
    else router.back();
  }

  async function handleCreate() {
    setLoading(true);
    // In production: create company + owner membership via Supabase
    // For now: switch to owner role in dev mode
    await new Promise((r) => setTimeout(r, 800));
    switchDevRole('owner');
    setLoading(false);
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
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: semantic.errorLight }]}>
            <Text style={[typeScale.bodySmall, { color: semantic.error }]}>{error}</Text>
          </View>
        ) : null}

        {step === 'company' && (
          <View style={styles.form}>
            <Input label="Company Name *" placeholder="e.g. Brighton Lawn + Landscape" value={companyName} onChangeText={setCompanyName} icon="briefcase" />
            <Input label="Company Phone" placeholder="(555) 555-0100" value={companyPhone} onChangeText={setCompanyPhone} keyboardType="phone-pad" icon="phone" />
            <Input label="Street Address" placeholder="123 Main St" value={companyAddress} onChangeText={setCompanyAddress} icon="map-pin" />
            <View style={styles.row}>
              <Input label="City" placeholder="Cleveland" value={companyCity} onChangeText={setCompanyCity} containerStyle={styles.flex2} />
              <Input label="State" placeholder="OH" value={companyState} onChangeText={setCompanyState} containerStyle={styles.flex1} />
              <Input label="ZIP" placeholder="44101" value={companyZip} onChangeText={setCompanyZip} keyboardType="number-pad" containerStyle={styles.flex1} />
            </View>
            <Button title="Next" onPress={handleNext} fullWidth size="lg" icon="arrow-right" />
          </View>
        )}

        {step === 'owner' && (
          <View style={styles.form}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              You'll be the company owner with full administrative access.
            </Text>
            <View style={styles.row}>
              <Input label="First Name *" placeholder="Joey" value={firstName} onChangeText={setFirstName} containerStyle={{ flex: 1 }} />
              <Input label="Last Name *" placeholder="Angeloco" value={lastName} onChangeText={setLastName} containerStyle={{ flex: 1 }} />
            </View>
            <Input label="Email *" placeholder="you@company.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail" />
            <Input label="Phone *" placeholder="(555) 555-0100" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="phone" />
            <Input label="Password *" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry icon="lock" />
            <Input label="Confirm Password *" placeholder="Re-enter password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry icon="lock" />
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
                  {firstName} {lastName}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{email}</Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{phone}</Text>
                <View style={[styles.roleBadge, { backgroundColor: colors.primarySurface }]}>
                  <Feather name="shield" size={12} color={colors.primary} />
                  <Text style={[typeScale.caption, { color: colors.primary, fontWeight: '600', marginLeft: 4 }]}>
                    Company Owner
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.primarySurface, borderColor: colors.primary }]}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
                As the company owner, you'll have full control over your team, projects, and settings. You can invite workers and customers after setup.
              </Text>
            </View>

            <Button title="Create Company" onPress={handleCreate} loading={loading} fullWidth size="lg" icon="check-circle" />
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
    padding: spacing.md,
    borderRadius: radius.xs,
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
    borderRadius: radius.xs,
    borderLeftWidth: 3,
  },
});
