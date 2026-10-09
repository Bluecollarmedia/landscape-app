import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Alert, Switch, Image, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, Input, Card } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { db, useDb, updateRow } from '@/data/store';
import { attachImage } from '@/data/actions';
import { useCompanySetup, SETUP_STEPS } from '@/hooks/useCompanySetup';
import { useTrucks } from '@/hooks/useTrucks';
import { usePayroll, useNotifications } from '@/hooks/useOperations';
import { useTeamCode, useJoinRequests } from '@/hooks/useOnboarding';
import { inviteMessage, textInvite, copyText } from '@/lib/invite';
import { EVENT_LABELS, ALL_EVENTS } from '@/lib/notificationEvents';
import { getCompanyImageUri } from '@/lib/projectImages';
import type { SetupStepKey } from '@/types/company';

/** Recommended first-time setup for the owner. Opens automatically until it's been walked through once. */
export default function CompanySetupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ step?: string }>();
  useDb();
  const setup = useCompanySetup();

  const startIndex = Math.max(0, SETUP_STEPS.findIndex((s) => s.key === params.step));
  const [index, setIndex] = useState(startIndex);
  const step = setup.steps[index];
  const isLast = index === SETUP_STEPS.length - 1;

  function confirm(title: string, message: string, ok: string, onOk: () => void) {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onOk();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Go Back', style: 'cancel' },
      { text: ok, style: 'destructive', onPress: onOk },
    ]);
  }

  function advance() {
    if (isLast) {
      setup.finishWalkthrough();
      router.back();
    } else {
      setIndex(index + 1);
    }
  }

  function handleContinue(key: SetupStepKey) {
    setup.markDone(key);
    advance();
  }

  function handleSkip() {
    confirm(
      'Skip this step?',
      'This is recommended so the app works properly. It will stay on your dashboard checklist until it’s done.',
      'Skip for Now',
      () => { setup.skip(step.key); advance(); },
    );
  }

  function handleClose() {
    confirm(
      'Finish setup later?',
      'Setup will open again the next time you open the app until you’ve gone through every step.',
      'Later',
      () => router.back(),
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.overline, { color: colors.primary }]}>
            RECOMMENDED SETUP · STEP {index + 1} OF {SETUP_STEPS.length}
          </Text>
          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginTop: 2 }]}>{step.title}</Text>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{step.subtitle}</Text>
        </View>
        <Pressable onPress={handleClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Finish later">
          <Icon name="x" size={24} color={colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.progressRow}>
        {setup.steps.map((s, i) => (
          <Pressable
            key={s.key}
            onPress={() => setIndex(i)}
            style={[
              styles.progressDot,
              { backgroundColor: s.done ? colors.primary : i === index ? colors.primaryLight : colors.borderLight },
            ]}
            accessibilityLabel={`Step ${i + 1}: ${s.title}${s.done ? ', done' : ''}`}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step.key === 'trucks' && <TrucksStep />}
        {step.key === 'workers' && <WorkersStep />}
        {step.key === 'payRates' && <PayRatesStep onGoToWorkers={() => setIndex(1)} />}
        {step.key === 'notifications' && <NotificationsStep />}
        {step.key === 'company' && <CompanyStep onSaved={() => handleContinue('company')} />}
      </ScrollView>

      {step.key !== 'company' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.borderLight, backgroundColor: colors.background }]}>
          <Button
            title={isLast ? 'Finish Setup' : 'Save & Continue'}
            onPress={() => handleContinue(step.key)}
            icon="arrow-right"
            iconPosition="right"
            fullWidth
            disabled={!canContinue(step.key)}
          />
          <Pressable onPress={handleSkip} hitSlop={8} style={styles.skipLink}>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Skip for now</Text>
          </Pressable>
        </View>
      )}
      {step.key === 'company' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.borderLight, backgroundColor: colors.background }]}>
          <Pressable onPress={handleSkip} hitSlop={8} style={styles.skipLink}>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Skip for now</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** Steps that need real data before "Save & Continue" works; the rest can be confirmed as-is. */
function canContinue(key: SetupStepKey): boolean {
  if (key === 'trucks') return db.trucks.length > 0;
  return true;
}

// ── Step 1: trucks ──────────────────────────────────────────────────────────

function TrucksStep() {
  const { colors } = useTheme();
  const { allTrucks, addTruck } = useTrucks();
  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');

  function handleAdd() {
    if (!name.trim()) return;
    addTruck({
      companyId: db.companyId,
      name: name.trim(),
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      licensePlate: plate.trim() || undefined,
      status: 'available',
    });
    setName(''); setMake(''); setModel(''); setPlate('');
  }

  return (
    <>
      {allTrucks.length > 0 && (
        <Card title={`Your trucks (${allTrucks.length})`} style={styles.section}>
          {allTrucks.map((t) => (
            <View key={t.id} style={[styles.listItem, { borderBottomColor: colors.borderLight }]}>
              <Icon name="truck" size={16} color={colors.primary} />
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{t.name}</Text>
              <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                {[t.make, t.model, t.licensePlate].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </Card>
      )}
      <Card title={allTrucks.length ? 'Add another truck' : 'Add a truck'} style={styles.section}>
        <View style={styles.form}>
          <Input label="Truck name" placeholder="e.g. Truck 1 or Big Ford" value={name} onChangeText={setName} icon="truck" />
          <View style={styles.row}>
            <Input label="Make" placeholder="Ford" value={make} onChangeText={setMake} containerStyle={{ flex: 1 }} />
            <Input label="Model" placeholder="F-250" value={model} onChangeText={setModel} containerStyle={{ flex: 1 }} />
          </View>
          <Input label="License plate (optional)" placeholder="ABC-1234" value={plate} onChangeText={setPlate} autoCapitalize="characters" />
          <Button title="Add Truck" onPress={handleAdd} icon="plus" variant="secondary" fullWidth disabled={!name.trim()} />
        </View>
      </Card>
      <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
        Add every truck now. You can add photos and more details later under More → Trucks.
      </Text>
    </>
  );
}

// ── Step 2: workers ─────────────────────────────────────────────────────────

function WorkersStep() {
  const { colors } = useTheme();
  const { activeCode } = useTeamCode();
  const { pendingRequests } = useJoinRequests();
  const [invName, setInvName] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const workers = db.members.filter((m) => m.role === 'worker' && m.status === 'active' && m.person);

  async function handleText() {
    if (!activeCode) return;
    await textInvite(inviteMessage(activeCode.code, db.company?.name, invName), invPhone);
    if (Platform.OS === 'web') alert('Invite message copied. Paste it into a text to your worker.');
    setInvName(''); setInvPhone('');
  }

  async function handleCopy() {
    if (!activeCode) return;
    await copyText(activeCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Card title="Team code" style={styles.section}>
        <Pressable onPress={handleCopy} style={[styles.codeBox, { backgroundColor: colors.primarySurface }]}>
          <Text style={[typeScale.displaySmall, { color: colors.primary, fontWeight: '700', letterSpacing: 2 }]}>
            {activeCode?.code ?? '—'}
          </Text>
          <Text style={[typeScale.caption, { color: copied ? semantic.success : colors.textSecondary, marginTop: 4 }]}>
            {copied ? 'Copied!' : 'Tap to copy'}
          </Text>
        </Pressable>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
          Each worker downloads the app, taps Join a Team, and enters this code. You approve them under More → Pending Requests.
        </Text>
      </Card>
      <Card title="Text an invite" style={styles.section}>
        <View style={styles.form}>
          <Input label="Name (optional)" placeholder="Worker's name" value={invName} onChangeText={setInvName} icon="user" />
          <Input label="Phone (optional)" placeholder="(555) 555-0100" value={invPhone} onChangeText={setInvPhone} keyboardType="phone-pad" icon="phone" />
          <Button title="Send Text Invite" onPress={handleText} icon="message-circle" variant="secondary" fullWidth disabled={!activeCode} />
        </View>
      </Card>
      <Card title={`On your team (${workers.length})`} style={styles.section}>
        {workers.length === 0 ? (
          <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>No workers yet.</Text>
        ) : workers.map((w) => (
          <View key={w.id} style={[styles.listItem, { borderBottomColor: colors.borderLight }]}>
            <Icon name="user" size={16} color={colors.primary} />
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>
              {`${w.person!.firstName} ${w.person!.lastName}`.trim()}
            </Text>
          </View>
        ))}
        {pendingRequests.length > 0 && (
          <Text style={[typeScale.caption, { color: semantic.warning, marginTop: spacing.sm }]}>
            {pendingRequests.length} waiting for your approval in More → Pending Requests.
          </Text>
        )}
      </Card>
    </>
  );
}

// ── Step 3: pay rates ───────────────────────────────────────────────────────

function PayRatesStep({ onGoToWorkers }: { onGoToWorkers: () => void }) {
  const { colors } = useTheme();
  const { getCurrentRate, setHourlyRate } = usePayroll();
  const workers = db.members.filter((m) => m.role === 'worker' && m.status === 'active' && m.person);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (workers.length === 0) {
    return (
      <Card style={styles.section}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>No workers on the team yet.</Text>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md }]}>
          Once workers join, set their hourly rates here or under More → Payroll. This step stays on your dashboard checklist until it's done.
        </Text>
        <Button title="Back to Invite Workers" onPress={onGoToWorkers} variant="ghost" icon="arrow-left" />
      </Card>
    );
  }

  return (
    <Card title="Hourly rates" style={styles.section}>
      {workers.map((w) => {
        const current = getCurrentRate(w.personId);
        const draft = drafts[w.personId] ?? (current ? String(current) : '');
        const parsed = parseFloat(draft);
        const changed = !isNaN(parsed) && parsed > 0 && parsed !== current;
        return (
          <View key={w.id} style={[styles.rateRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
              {`${w.person!.firstName} ${w.person!.lastName}`.trim()}
            </Text>
            <Input
              placeholder="$/hr"
              value={draft}
              onChangeText={(t) => setDrafts((d) => ({ ...d, [w.personId]: t.replace(/[^0-9.]/g, '') }))}
              keyboardType="decimal-pad"
              containerStyle={{ width: 100 }}
            />
            <Button
              title={current && !changed ? 'Saved' : 'Save'}
              size="sm"
              variant={changed ? 'primary' : 'ghost'}
              disabled={!changed}
              onPress={() => setHourlyRate(w.personId, parsed)}
            />
          </View>
        );
      })}
    </Card>
  );
}

// ── Step 4: notifications ───────────────────────────────────────────────────

function NotificationsStep() {
  const { colors } = useTheme();
  const { getCompanyDefault, updatePreference } = useNotifications();

  return (
    <Card title="Tell me when…" style={styles.section}>
      {ALL_EVENTS.map((ev) => {
        const pref = getCompanyDefault(ev);
        const info = EVENT_LABELS[ev];
        return (
          <View key={ev} style={[styles.listItem, { borderBottomColor: colors.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{info.label}</Text>
              <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{info.description}</Text>
            </View>
            <Switch
              value={pref?.enabled ?? true}
              disabled={!pref}
              onValueChange={(on) => pref && updatePreference(pref.id, on)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        );
      })}
      <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
        You can turn alerts on or off per worker later under More → Notifications.
      </Text>
    </Card>
  );
}

// ── Step 5: company info + dashboard photo ──────────────────────────────────

function CompanyStep({ onSaved }: { onSaved: () => void }) {
  const { colors } = useTheme();
  const c = db.company;
  const [phone, setPhone] = useState(c?.phone ?? '');
  const [email, setEmail] = useState(c?.email ?? '');
  const [address, setAddress] = useState(c?.address ?? '');
  const [city, setCity] = useState(c?.city ?? '');
  const [state, setState] = useState(c?.state ?? '');
  const [zip, setZip] = useState(c?.zip ?? '');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const preview = useMemo(() => photoUri ?? getCompanyImageUri(), [photoUri, c?.coverPhotoUrl]);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = 'Photo library access is needed to choose a dashboard photo.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Permission Needed', msg);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
  }

  function handleSave() {
    if (!c) return;
    updateRow('companies', c.id, {
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zip: zip.trim() || undefined,
    });
    if (photoUri) attachImage('companies', c.id, 'coverPhotoUrl', photoUri, 'company');
    onSaved();
  }

  return (
    <>
      <Card title="Dashboard photo" style={styles.section}>
        <Pressable onPress={pickPhoto} style={styles.photoBox}>
          <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.photoBadge}>
            <Icon name="camera" size={14} color="#FFFFFF" />
            <Text style={[typeScale.labelSmall, { color: '#FFFFFF', marginLeft: 6 }]}>
              {photoUri || c?.coverPhotoUrl ? 'Change photo' : 'Choose your own photo'}
            </Text>
          </View>
        </Pressable>
        <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
          Shown at the top of your dashboard and on the workers' home screen.
        </Text>
      </Card>
      <Card title={c?.name ?? 'Company'} style={styles.section}>
        <View style={styles.form}>
          <Input label="Business phone" placeholder="(555) 555-0100" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="phone" />
          <Input label="Business email" placeholder="office@company.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail" />
          <Input label="Address" placeholder="Street address" value={address} onChangeText={setAddress} icon="map-pin" />
          <Input label="City" value={city} onChangeText={setCity} />
          <View style={styles.row}>
            <Input label="State" value={state} onChangeText={setState} autoCapitalize="characters" containerStyle={{ flex: 1 }} />
            <Input label="ZIP" value={zip} onChangeText={setZip} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
          </View>
        </View>
      </Card>
      <Button title="Save & Finish Setup" onPress={handleSave} icon="check" fullWidth />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  progressDot: { flex: 1, height: 6, borderRadius: 3 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  section: { marginBottom: spacing.lg },
  form: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  codeBox: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  photoBox: {
    height: 160,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  skipLink: { paddingTop: spacing.sm },
});
