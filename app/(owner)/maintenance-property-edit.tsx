/**
 * Add / edit a maintenance property with its contract and recurring services,
 * all in one form (entered once at the start of the season, edited as needed).
 *
 *   /(owner)/maintenance-property-edit          → new property
 *   /(owner)/maintenance-property-edit?id=…     → edit property, its active
 *                                                 (or latest) contract and rules
 *
 * A modal above the tabs (see CLAUDE.md "Owner Navigation Architecture") so it
 * can be opened from the Maintenance tab or a route without switching tabs.
 * Saved services are never deleted, only turned off, so visits keep their history.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform, ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { ListSection, ListRow, SearchBar, Switch, Avatar } from '@/components/ui';
import { AddressFields, type AddressCheck } from '@/components/ui/AddressFields';
import { DateRow, InputRow, NoteField } from '@/components/financials/FormBits';
import { useTheme } from '@/providers/ThemeProvider';
import { useCustomers } from '@/hooks/useCustomers';
import { QuickAddCustomer } from '@/components/customers/QuickAddCustomer';
import { useMaintenanceProperty } from '@/hooks/useMaintenance';
import { db } from '@/data/store';
import {
  createProperty, updateProperty, createContract, updateContract,
  addServiceRule, updateServiceRule, ruleProblem, type ServiceRuleInput,
} from '@/data/maintenance';
import { frequencyLabel } from '@/lib/maintenanceSchedule';
import { todayKey } from '@/lib/ids';
import { haptics } from '@/lib/haptics';
import type { AddressParts } from '@/lib/address';
import { spreadDates, cleanDates } from '@/lib/serviceDates';
import { SERVICE_TYPES, type MaintenanceServiceRule, type ServiceFrequency } from '@/types/maintenance';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') alert(msg);
  else Alert.alert(title, msg);
}

// ── Service drafts ──────────────────────────────────────────────────────────

interface ServiceDraft {
  key: string;
  /** Set for saved rules. */
  id?: string;
  serviceType: string;
  label: string;
  frequency: ServiceFrequency;
  intervalDays: string;
  startsOn?: string;
  windowStart?: string;
  windowEnd?: string;
  /** For "Set number of visits": the exact dates, and the span they were spread across. */
  scheduledDates: string[];
  spreadFrom?: string;
  spreadTo?: string;
  seasonQuantity: string;
  priorCompletedCount: string;
  lastCompletedOn?: string;
  requiresPhotos: boolean;
  /** One checklist item per line. */
  checklist: string;
  instructions: string;
  isActive: boolean;
}

const FREQUENCIES: { key: ServiceFrequency; label: string }[] = [
  { key: 'weekly', label: 'Every week' },
  { key: 'biweekly', label: 'Every 2 weeks' },
  { key: 'every_n_days', label: 'Every N days' },
  { key: 'fixed_dates', label: 'Set number of visits' },
  { key: 'seasonal_window', label: 'Once, in a date range' },
  { key: 'as_needed', label: 'As needed' },
];

/**
 * Starting values when the owner picks a service type. Only suggestions to
 * save typing; every field stays editable per property.
 */
function suggestedFor(type: string, year: string): Partial<ServiceDraft> {
  switch (type) {
    case 'lawn_cut': return { frequency: 'weekly' };
    case 'spring_cleanup': return { frequency: 'seasonal_window', windowStart: `${year}-04-01`, windowEnd: `${year}-05-15` };
    case 'fall_cleanup': return { frequency: 'seasonal_window', windowStart: `${year}-10-15`, windowEnd: `${year}-11-30` };
    case 'shrub_trim': return { frequency: 'seasonal_window', windowStart: `${year}-07-01`, windowEnd: `${year}-07-31` };
    case 'fertilization': return { frequency: 'seasonal_window', windowStart: `${year}-10-01`, windowEnd: `${year}-11-15` };
    case 'mulch': return { frequency: 'seasonal_window', windowStart: `${year}-04-15`, windowEnd: `${year}-05-31` };
    default: return { frequency: 'as_needed' };
  }
}

let draftSeq = 0;
const nextKey = () => `draft-${++draftSeq}`;

function newDraft(type: string, year: string): ServiceDraft {
  const t = SERVICE_TYPES.find((s) => s.key === type);
  return {
    key: nextKey(),
    serviceType: type,
    label: t && type !== 'other' ? t.label : '',
    frequency: 'weekly',
    intervalDays: '',
    scheduledDates: [],
    seasonQuantity: '',
    priorCompletedCount: '',
    requiresPhotos: false,
    checklist: '',
    instructions: '',
    isActive: true,
    ...suggestedFor(type, year),
  };
}

function draftFromRule(r: MaintenanceServiceRule): ServiceDraft {
  return {
    key: r.id,
    id: r.id,
    serviceType: r.serviceType,
    label: r.label,
    frequency: r.frequency,
    intervalDays: r.intervalDays != null ? String(r.intervalDays) : '',
    startsOn: r.startsOn,
    windowStart: r.windowStart,
    windowEnd: r.windowEnd,
    scheduledDates: cleanDates(r.scheduledDates),
    spreadFrom: cleanDates(r.scheduledDates)[0],
    spreadTo: cleanDates(r.scheduledDates).slice(-1)[0],
    seasonQuantity: r.seasonQuantity != null ? String(r.seasonQuantity) : '',
    priorCompletedCount: r.priorCompletedCount ? String(r.priorCompletedCount) : '',
    lastCompletedOn: r.lastCompletedOn,
    requiresPhotos: r.requiresPhotos,
    checklist: r.defaultChecklist.join('\n'),
    instructions: r.instructions ?? '',
    isActive: r.isActive,
  };
}

const toInt = (s: string): number | undefined => {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};

function draftToInput(d: ServiceDraft, sortOrder: number): ServiceRuleInput {
  const window = d.frequency === 'seasonal_window';
  const fixed = d.frequency === 'fixed_dates';
  const fixedDates = fixed ? cleanDates(d.scheduledDates) : [];
  const repeating = d.frequency === 'weekly' || d.frequency === 'biweekly' || d.frequency === 'every_n_days';
  return {
    serviceType: d.serviceType,
    label: d.label.trim(),
    frequency: d.frequency,
    // Clear fields that don't apply to the chosen frequency, so an old value
    // can't quietly change the due date.
    intervalDays: d.frequency === 'every_n_days' ? toInt(d.intervalDays) : undefined,
    startsOn: repeating ? d.startsOn : undefined,
    windowStart: window ? d.windowStart : undefined,
    windowEnd: window ? d.windowEnd : undefined,
    scheduledDates: fixed ? fixedDates : undefined,
    // For a set number of visits the count is always the number of saved dates.
    seasonQuantity: d.frequency === 'as_needed' ? undefined : fixed ? fixedDates.length : toInt(d.seasonQuantity),
    priorCompletedCount: toInt(d.priorCompletedCount) ?? 0,
    lastCompletedOn: d.lastCompletedOn,
    requiresPhotos: d.requiresPhotos,
    defaultChecklist: d.checklist.split('\n').map((s) => s.trim()).filter(Boolean),
    instructions: d.instructions.trim() || undefined,
    isActive: d.isActive,
    sortOrder,
  };
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function MaintenancePropertyEditScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const detail = useMaintenanceProperty(params.id);
  const existing = detail?.property;
  const existingContract = detail ? detail.activeContract ?? detail.contracts[0] : undefined;
  const existingRules = useMemo(
    () => (existingContract ? db.maintenance.rulesByContract[existingContract.id] ?? [] : []),
    // Snapshot when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existingContract?.id],
  );
  const { allCustomers, getCustomer } = useCustomers();

  const [name, setName] = useState(existing?.name ?? '');
  const [customerId, setCustomerId] = useState<string | undefined>(existing?.customerId);
  const [sourceProjectId, setSourceProjectId] = useState<string | undefined>(existing?.sourceProjectId);
  const [address, setAddress] = useState<AddressParts>({
    address: existing?.address ?? '', city: existing?.city ?? '', state: existing?.state ?? '', zip: existing?.zip ?? '',
  });
  const [check, setCheck] = useState<AddressCheck>(
    existing?.latitude != null ? { latitude: existing.latitude, longitude: existing.longitude } : {},
  );
  const [accessNotes, setAccessNotes] = useState(existing?.accessNotes ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const year = todayKey().slice(0, 4);
  const [contractName, setContractName] = useState(existingContract?.name ?? `${year} season`);
  const [seasonStart, setSeasonStart] = useState<string | undefined>(existingContract?.seasonStart);
  const [seasonEnd, setSeasonEnd] = useState<string | undefined>(existingContract?.seasonEnd);
  const [contractNotes, setContractNotes] = useState(existingContract?.notes ?? '');

  const [services, setServices] = useState<ServiceDraft[]>(() => existingRules.map(draftFromRule));
  const [openKey, setOpenKey] = useState<string | undefined>();
  const [picking, setPicking] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [addingType, setAddingType] = useState(false);
  const [saving, setSaving] = useState(false);

  const customer = customerId ? getCustomer(customerId) : undefined;
  const seasonYear = (seasonStart ?? todayKey()).slice(0, 4);

  const customerMatches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return allCustomers
      .filter((c) => !q || `${c.person.firstName} ${c.person.lastName} ${c.person.email}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allCustomers, customerSearch]);

  // Projects of the chosen customer that have an address to copy.
  const addressSources = useMemo(
    () => (customer?.projects ?? []).filter((p) => !!p.address),
    [customer],
  );

  function pickCustomer(id: string | undefined) {
    haptics.select();
    setCustomerId(id);
    setPicking(false);
    setCustomerSearch('');
    const c = id ? getCustomer(id) : undefined;
    if (c && !name.trim()) setName(`${c.person.lastName} Residence`);
  }

  function useProjectAddress(projectId: string) {
    const p = db.projects.find((x) => x.id === projectId);
    if (!p) return;
    haptics.select();
    setAddress({ address: p.address ?? '', city: p.city ?? '', state: p.state ?? '', zip: p.zip ?? '' });
    setCheck(p.latitude != null ? { latitude: p.latitude, longitude: p.longitude } : {});
    setSourceProjectId(p.id);
  }

  function patchService(key: string, patch: Partial<ServiceDraft>) {
    setServices((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addService(type: string) {
    const d = newDraft(type, seasonYear);
    setServices((prev) => [...prev, d]);
    setOpenKey(d.key);
    setAddingType(false);
    haptics.select();
  }

  function removeDraft(key: string) {
    setServices((prev) => prev.filter((s) => s.key !== key));
    if (openKey === key) setOpenKey(undefined);
  }

  function handleSave() {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) return notify('Name Needed', 'Give the property a name you’ll recognize, like "Mitchell Residence".');
    if (!address.address.trim()) return notify('Address Needed', 'Add the service address so the crew can find it.');
    if (seasonStart && seasonEnd && seasonEnd < seasonStart) return notify('Check the Season', 'The season ends before it starts.');
    for (const [i, s] of services.entries()) {
      const problem = ruleProblem(draftToInput(s, i));
      if (problem) {
        setOpenKey(s.key);
        return notify(s.label.trim() || 'Service', problem);
      }
    }

    setSaving(true);
    const propertyFields = {
      name: trimmed,
      customerId,
      sourceProjectId: customerId ? sourceProjectId : undefined,
      address: address.address.trim(),
      city: address.city.trim() || undefined,
      state: address.state.trim() || undefined,
      zip: address.zip.trim() || undefined,
      latitude: check.latitude,
      longitude: check.longitude,
      accessNotes: accessNotes.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    const contractFields = {
      name: contractName.trim() || `${seasonYear} season`,
      seasonStart,
      seasonEnd,
      notes: contractNotes.trim() || undefined,
    };

    let propertyId: string;
    if (existing) {
      updateProperty(existing.id, propertyFields);
      propertyId = existing.id;
    } else {
      propertyId = createProperty(propertyFields).id;
    }

    let contractId: string;
    if (existingContract) {
      updateContract(existingContract.id, contractFields);
      contractId = existingContract.id;
    } else {
      contractId = createContract(propertyId, contractFields).id;
    }

    const failures: string[] = [];
    services.forEach((s, i) => {
      const input = draftToInput(s, i);
      const res = s.id ? updateServiceRule(s.id, input) : addServiceRule(contractId, input);
      if (!res.ok) failures.push(`${s.label}: ${res.error}`);
    });

    haptics.success();
    if (failures.length) notify('Some Services Weren’t Saved', failures.join('\n'));
    // Close this pop-up the same way the other create screens do, then open the
    // property. (A replace straight from this pop-up into the Maintenance tab
    // could leave the editor on screen while the screen underneath changed.)
    if (router.canGoBack()) router.back();
    if (!existing) router.push(`/(owner)/maintenance/properties/${propertyId}` as any);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeButton, { backgroundColor: colors.surface }, shadow.sm]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Icon name="x" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.displayLarge, { color: colors.textPrimary, marginTop: spacing.md }]}>
          {existing ? 'Edit Property' : 'New Property'}
        </Text>
        <Text style={[typeScale.bodyLarge, { color: colors.textTertiary, marginTop: 2, marginBottom: spacing.lg }]}>
          Enter it once with its recurring services. Due dates are worked out from each service's schedule.
        </Text>

        {/* Property */}
        <ListSection title="PROPERTY">
          <InputRow label="Name" value={name} onChangeText={setName} placeholder="Mitchell Residence" autoCapitalize="words" />
          <ListRow
            icon="user"
            title={customer ? `${customer.person.firstName} ${customer.person.lastName}` : 'Customer'}
            subtitle={customer ? 'Linked customer' : 'Optional · pick one or add a new customer'}
            value={customer ? 'Change' : 'Choose'}
            onPress={() => setPicking((v) => !v)}
          />
          {picking && (
            <View style={styles.pad}>
              <SearchBar value={customerSearch} onChangeText={setCustomerSearch} placeholder="Search customers" autoFocus={Platform.OS === 'web'} />
              {customerMatches.map((c) => (
                <Pressable
                  key={c.person.id}
                  onPress={() => pickCustomer(c.person.id)}
                  style={({ pressed }) => [styles.pickRow, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${c.person.firstName} ${c.person.lastName}`}
                >
                  <Avatar firstName={c.person.firstName} lastName={c.person.lastName} uri={c.person.avatarUrl} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{c.person.firstName} {c.person.lastName}</Text>
                    {!!c.person.email && <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{c.person.email}</Text>}
                  </View>
                  {c.person.id === customerId && <Icon name="check" size={18} color={colors.primary} />}
                </Pressable>
              ))}
              {customerMatches.length === 0 && (
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, paddingVertical: spacing.sm }]}>
                  No customers match. Add a new one below, or leave this empty.
                </Text>
              )}
              <QuickAddCustomer onAdded={(id) => pickCustomer(id)} />
              {!!customerId && (
                <Pressable onPress={() => pickCustomer(undefined)} style={styles.pickRow} accessibilityRole="button">
                  <Icon name="x-circle" size={18} color={colors.textSecondary} />
                  <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>No customer</Text>
                </Pressable>
              )}
            </View>
          )}
        </ListSection>

        {/* Address */}
        <ListSection title="SERVICE ADDRESS">
          <View style={styles.pad}>
            {addressSources.length > 0 && (
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: 6 }]}>Use an address from {customer?.person.firstName}'s projects</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                  {addressSources.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => useProjectAddress(p.id)}
                      style={[styles.chip, { backgroundColor: sourceProjectId === p.id ? colors.primarySurface : colors.backgroundTertiary }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Use the address of ${p.name}`}
                    >
                      <Icon name="map-pin" size={13} color={colors.primary} />
                      <Text style={[typeScale.labelSmall, { color: colors.textPrimary }]} numberOfLines={1}>{p.address}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            <AddressFields
              value={address}
              onChange={(next) => { setAddress(next); setSourceProjectId(undefined); }}
              required
              check={check}
              onCheckChange={setCheck}
            />
          </View>
        </ListSection>

        <ListSection title="ACCESS NOTES" footer="Gate codes, pets, where to park. The crew sees this at the stop.">
          <NoteField label="Access notes" placeholder="Side gate code is with the owner. Dog in back yard." value={accessNotes} onChangeText={setAccessNotes} />
        </ListSection>
        <ListSection title="PROPERTY NOTES">
          <NoteField label="Property notes" placeholder="Anything else about this property" value={notes} onChangeText={setNotes} />
        </ListSection>

        {/* Contract */}
        <ListSection title="CONTRACT" footer="Repeating services aren't recommended outside the season. Leave the dates empty to allow any time.">
          <InputRow label="Contract" value={contractName} onChangeText={setContractName} placeholder={`${year} season`} />
          <DateRow label="Season starts" value={seasonStart} onChange={setSeasonStart} optional onClear={() => setSeasonStart(undefined)} />
          <DateRow label="Season ends" value={seasonEnd} onChange={setSeasonEnd} minimumDate={seasonStart} optional onClear={() => setSeasonEnd(undefined)} />
          <NoteField label="Contract notes" placeholder="Terms, price, anything agreed" value={contractNotes} onChangeText={setContractNotes} />
        </ListSection>

        {/* Services */}
        <ListSection title="RECURRING SERVICES" footer="Each service has its own schedule and history. Saved services can be turned off but not deleted, so past visits stay.">
          {services.map((s, i) => (
            <View key={s.key}>
              <ListRow
                icon={s.isActive ? 'repeat' : 'slash'}
                title={s.label.trim() || 'New service'}
                subtitle={s.isActive ? frequencyLabel(draftToInput(s, i) as MaintenanceServiceRule) : 'Turned off'}
                value={openKey === s.key ? 'Done' : 'Edit'}
                onPress={() => setOpenKey(openKey === s.key ? undefined : s.key)}
              />
              {openKey === s.key && (
                <ServiceEditor
                  draft={s}
                  seasonStart={seasonStart}
                  seasonEnd={seasonEnd}
                  onChange={(patch) => patchService(s.key, patch)}
                  onRemove={s.id ? undefined : () => removeDraft(s.key)}
                />
              )}
            </View>
          ))}
          {addingType ? (
            <View style={styles.pad}>
              <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: 6 }]}>What kind of service?</Text>
              <View style={styles.chipWrap}>
                {SERVICE_TYPES.map((t) => (
                  <Pressable
                    key={t.key}
                    onPress={() => addService(t.key)}
                    style={[styles.chip, { backgroundColor: colors.backgroundTertiary }]}
                    accessibilityRole="button"
                  >
                    <Text style={[typeScale.labelSmall, { color: colors.textPrimary }]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <ListRow icon="plus" title="Add Service" onPress={() => setAddingType(true)} />
          )}
        </ListSection>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: pressed ? colors.primaryDark : colors.primary, opacity: saving ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          <Icon name="check" size={18} color={colors.textOnPrimary} />
          <Text style={[typeScale.labelLarge, { color: colors.textOnPrimary, fontSize: 17 }]}>
            {existing ? 'Save Changes' : 'Add Property'}
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

// ── One service's settings ──────────────────────────────────────────────────

function ServiceEditor({ draft: d, onChange, onRemove, seasonStart, seasonEnd }: {
  draft: ServiceDraft;
  /** The contract's season: where "Set number of visits" spreads the visits by default. */
  seasonStart?: string;
  seasonEnd?: string;
  onChange: (patch: Partial<ServiceDraft>) => void;
  onRemove?: () => void;
}) {
  const { colors } = useTheme();
  const repeating = d.frequency === 'weekly' || d.frequency === 'biweekly' || d.frequency === 'every_n_days';
  const window = d.frequency === 'seasonal_window';
  const fixed = d.frequency === 'fixed_dates';

  /** Changing the number of visits or the first/last date works out the dates again, evenly. */
  function respread(patch: Partial<ServiceDraft>) {
    const next = { ...d, ...patch };
    const dates = spreadDates(next.spreadFrom ?? seasonStart, next.spreadTo ?? seasonEnd, toInt(next.seasonQuantity) ?? 0);
    onChange({ ...patch, ...(dates.length ? { scheduledDates: dates } : {}) });
  }
  function setDates(dates: string[]) {
    onChange({ scheduledDates: dates, seasonQuantity: String(dates.length) });
  }

  return (
    <View style={[styles.editor, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
      <InputRow label="Name" value={d.label} onChangeText={(t) => onChange({ label: t })} placeholder="Lawn cut" autoCapitalize="sentences" />

      <View style={styles.pad}>
        <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: 6 }]}>How often</Text>
        <View style={styles.chipWrap}>
          {FREQUENCIES.map((f) => {
            const on = d.frequency === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  haptics.select();
                  if (f.key === 'fixed_dates') respread({ frequency: f.key, spreadFrom: d.spreadFrom ?? seasonStart, spreadTo: d.spreadTo ?? seasonEnd });
                  else onChange({ frequency: f.key });
                }}
                style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.border }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[typeScale.labelSmall, { color: on ? colors.textOnPrimary : colors.textPrimary }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {d.frequency === 'every_n_days' && (
        <InputRow label="Days between visits" value={d.intervalDays} onChangeText={(t) => onChange({ intervalDays: t })} keyboardType="number-pad" placeholder="10" suffix="days" />
      )}
      {window && (
        <>
          <DateRow label="Due from" value={d.windowStart} onChange={(k) => onChange({ windowStart: k })} />
          <DateRow label="Due by" value={d.windowEnd} onChange={(k) => onChange({ windowEnd: k })} minimumDate={d.windowStart} />
        </>
      )}
      {fixed && (
        <>
          <InputRow label="Number of visits" value={d.seasonQuantity} onChangeText={(t) => respread({ seasonQuantity: t })} keyboardType="number-pad" placeholder="6" suffix="visits" />
          <DateRow label="First visit" value={d.spreadFrom ?? seasonStart} onChange={(k) => respread({ spreadFrom: k })} />
          <DateRow label="Last visit" value={d.spreadTo ?? seasonEnd} onChange={(k) => respread({ spreadTo: k })} minimumDate={d.spreadFrom ?? seasonStart} />
          <Text style={[typeScale.caption, { color: colors.textTertiary, paddingHorizontal: spacing.md, paddingBottom: spacing.xs }]}>
            The visits are spread evenly from the first to the last date (they start from the Season dates above unless you change them). Change the number or either date and they are worked out again. You can also change any single date below, or add your own.
          </Text>
          {d.scheduledDates.map((date, i) => (
            <View key={`${i}-${date}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <DateRow label={`Visit ${i + 1}`} value={date} onChange={(k) => setDates(d.scheduledDates.map((x, j) => (j === i ? k : x)))} />
              </View>
              <Pressable onPress={() => setDates(d.scheduledDates.filter((_, j) => j !== i))} hitSlop={10} style={{ paddingHorizontal: spacing.md }} accessibilityRole="button" accessibilityLabel={`Remove visit ${i + 1}`}>
                <Icon name="x" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() => setDates([...d.scheduledDates, d.scheduledDates.slice(-1)[0] ?? d.spreadTo ?? seasonEnd ?? d.spreadFrom ?? seasonStart ?? todayKey()])}
            style={styles.removeRow}
            accessibilityRole="button"
          >
            <Icon name="plus" size={16} color={colors.primary} />
            <Text style={[typeScale.bodyLarge, { color: colors.primary }]}>Add a date</Text>
          </Pressable>
        </>
      )}
      {repeating && (
        <DateRow label="First service" value={d.startsOn} onChange={(k) => onChange({ startsOn: k })} optional onClear={() => onChange({ startsOn: undefined })} />
      )}
      {d.frequency !== 'as_needed' && !fixed && (
        <InputRow label="Visits this season" value={d.seasonQuantity} onChangeText={(t) => onChange({ seasonQuantity: t })} keyboardType="number-pad" placeholder="No limit" />
      )}
      {!fixed && <DateRow label="Last done" value={d.lastCompletedOn} onChange={(k) => onChange({ lastCompletedOn: k })} optional onClear={() => onChange({ lastCompletedOn: undefined })} />}
      {!!d.seasonQuantity && (
        <InputRow label="Already done this season" value={d.priorCompletedCount} onChangeText={(t) => onChange({ priorCompletedCount: t })} keyboardType="number-pad" placeholder="0" />
      )}
      <Text style={[typeScale.caption, { color: colors.textTertiary, paddingHorizontal: spacing.md, paddingBottom: spacing.xs }]}>
        {repeating
          ? '"Last done" and "Already done" cover work before it was tracked here. Without a last-done or first-service date, this shows as "Schedule not set" instead of guessing.'
          : '"Last done" covers work before it was tracked here.'}
      </Text>

      <View style={styles.switchRow}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>Completion photos required</Text>
        <Switch value={d.requiresPhotos} onValueChange={(v) => onChange({ requiresPhotos: v })} accessibilityLabel="Completion photos required" />
      </View>
      <NoteField label="Checklist" placeholder={'Checklist for every visit, one per line\nBlow off driveway and walks'} value={d.checklist} onChangeText={(t) => onChange({ checklist: t })} />
      <NoteField label="Instructions" placeholder="Standing instructions for this service" value={d.instructions} onChangeText={(t) => onChange({ instructions: t })} />

      {onRemove ? (
        <Pressable onPress={onRemove} style={styles.removeRow} accessibilityRole="button">
          <Icon name="trash-2" size={16} color={colors.error} />
          <Text style={[typeScale.bodyLarge, { color: colors.error }]}>Remove</Text>
        </Pressable>
      ) : (
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>Active</Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Turned off services keep their history.</Text>
          </View>
          <Switch value={d.isActive} onValueChange={(v) => onChange({ isActive: v })} accessibilityLabel="Service active" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, minHeight: 44 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', maxWidth: 260,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  editor: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 52 },
  removeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, minHeight: 48 },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    height: 56, borderRadius: radius.full, marginTop: spacing.md,
  },
});
