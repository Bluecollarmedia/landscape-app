/**
 * Owner/admin: one snow property's details — contacts, the services it gets,
 * and each service's instructions and reference photos/videos.
 *
 * Layout is a working first pass; the approved Snow Mode mockup will restyle
 * it. Everything here saves to the live database (supabase/updates/022).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { Button, Icon, Input, LoadingSpinner, SearchBar } from '@/components/ui';
import { QuickAddCustomer } from '@/components/customers/QuickAddCustomer';
import { TaskMediaStrip, TaskMediaViewer } from '@/components/tasks/TaskMedia';
import { snowMediaItems } from '@/components/snow/SnowReference';
import { notify, pickSnowMedia } from '@/components/snow/pickSnowMedia';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { db, useDb } from '@/data/store';
import { useSnowPropertyDetails } from '@/hooks/useSnowPropertyDetails';
import {
  addContact, addReferenceMedia, addService, referenceAsOf, removeContact, retireReferenceMedia, saveInstructions,
  setServiceActive, updateContact, type ContactInput, type SnowPropertyDetails,
} from '@/data/snowProperties';
import {
  SNOW_SERVICES, SNOW_SERVICE_ICONS, SNOW_SERVICE_LABELS,
  type SnowPropertyContact, type SnowPropertyService, type SnowService,
} from '@/types/snowProperty';

function confirmAction(title: string, message: string, action: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (confirm(`${title}\n\n${message}`)) run();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: run },
  ]);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Name and address from the foundation's snow_properties row. */
function usePropertyHeader(id?: string) {
  const [row, setRow] = useState<{ name?: string; address?: string; companyId?: string } | null>(null);
  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    supabase.from('snow_properties').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) setRow({ name: data.name, address: data.address ?? undefined, companyId: data.company_id });
    });
  }, [id]);
  return row;
}

export default function SnowPropertyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const header = usePropertyHeader(id);
  const { details, mediaUrls, error, loading, reload } = useSnowPropertyDetails(id);
  const companyId = header?.companyId ?? db.companyId;

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.surface }, shadow.sm]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.md }]} numberOfLines={2}>
          {header?.name ?? 'Snow Property'}
        </Text>
        {!!header?.address && (
          <Text style={[typeScale.bodyLarge, { color: colors.textTertiary, marginTop: 2 }]}>{header.address}</Text>
        )}

        {loading && !details && <LoadingSpinner style={{ marginTop: spacing['2xl'] }} />}
        {error && (
          <View style={[styles.card, { backgroundColor: colors.surface }, shadow.sm]}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{error}</Text>
            {isSupabaseConfigured && <Button title="Try Again" variant="secondary" size="sm" onPress={reload} style={{ alignSelf: 'flex-start', marginTop: spacing.md }} />}
          </View>
        )}
        {details && id && (
          <>
            <ContactsSection companyId={companyId} propertyId={id} contacts={details.contacts} onChanged={reload} />
            <Text style={[typeScale.overline, styles.sectionTitle, { color: colors.textTertiary }]}>SERVICES</Text>
            {SNOW_SERVICES.map((service) => (
              <ServiceCard
                key={service}
                companyId={companyId}
                propertyId={id}
                service={service}
                details={details}
                mediaUrls={mediaUrls}
                onChanged={reload}
              />
            ))}
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

// ── Contacts ────────────────────────────────────────────────────────────────

function ContactsSection({ companyId, propertyId, contacts, onChanged }: {
  companyId: string; propertyId: string; contacts: SnowPropertyContact[]; onChanged: () => void;
}) {
  const { colors } = useTheme();
  const v = useDb();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  // The property's customer: the linked account, else the main contact. Every property has one.
  const customer = contacts.find((x) => x.personId) ?? contacts.find((x) => x.isPrimary);
  const others = contacts.filter((x) => x.id !== customer?.id);
  const customers = useMemo(
    () => db.members
      .filter((m) => m.role === 'customer' && m.status !== 'inactive' && m.person)
      .sort((x, y) => `${x.person!.lastName} ${x.person!.firstName}`.localeCompare(`${y.person!.lastName} ${y.person!.firstName}`)),
    [v],
  );
  const q = query.trim().toLowerCase();
  const shown = q ? customers.filter((m) => `${m.person!.firstName} ${m.person!.lastName} ${m.person!.email}`.toLowerCase().includes(q)) : customers;

  /** Puts an existing customer on this property (their name, phone and email come from their record; nothing is typed). */
  async function linkCustomer(personId: string) {
    const m = db.members.find((x) => x.personId === personId);
    if (!m?.person || busy) return;
    const p = m.person;
    const input: ContactInput = {
      name: `${p.firstName} ${p.lastName}`.trim() || p.email, title: '', phone: p.phone ?? '', email: p.email ?? '', personId, isPrimary: true,
    };
    setBusy(true);
    const res = customer ? await updateContact(customer, input) : await addContact(companyId, propertyId, input);
    setBusy(false);
    if (!res.ok) return notify('Not Saved', res.error);
    haptics.success();
    setChoosing(false);
    setQuery('');
    onChanged();
  }

  return (
    <>
      <Text style={[typeScale.overline, styles.sectionTitle, { color: colors.textTertiary }]}>CUSTOMER</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }, shadow.sm]}>
        {customer && !choosing ? (
          <>
            <ContactRow contact={customer} onEdit={() => setChoosing(true)} customer />
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
              {customer.personId ? 'They see this property and its completed snow services in their app.' : 'Not linked to a customer account yet. Tap to choose the customer.'}
            </Text>
          </>
        ) : (
          <>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{customer ? 'Change the customer' : 'Choose the customer'}</Text>
            {customers.length > 5 ? <SearchBar value={query} onChangeText={setQuery} placeholder="Search your customers" style={{ marginTop: spacing.sm }} /> : null}
            {shown.slice(0, 40).map((m, i) => (
              <Pressable
                key={m.personId}
                onPress={() => linkCustomer(m.personId)}
                disabled={busy}
                style={[styles.pickRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }, busy && { opacity: 0.5 }]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{`${m.person!.firstName} ${m.person!.lastName}`.trim() || m.person!.email}</Text>
                  {m.person!.phone || m.person!.email ? <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{[m.person!.phone, m.person!.email].filter(Boolean).join(' · ')}</Text> : null}
                </View>
                {customer?.personId === m.personId ? <Icon name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            ))}
            {customers.length === 0 ? <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>No customers yet. Add one below.</Text> : null}
            <QuickAddCustomer onAdded={linkCustomer} />
            {customer ? <Button title="Cancel" variant="ghost" size="sm" onPress={() => { setChoosing(false); setQuery(''); }} style={{ alignSelf: 'flex-start' }} /> : null}
          </>
        )}
      </View>

      <Text style={[typeScale.overline, styles.sectionTitle, { color: colors.textTertiary }]}>OTHER CONTACTS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }, shadow.sm]}>
        {others.length === 0 && editing !== 'new' ? (
          <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>A property manager, a tenant or anyone else the crew may need to reach.</Text>
        ) : null}
        {others.map((o) => editing === o.id ? (
          <ContactForm key={o.id} companyId={companyId} propertyId={propertyId} contact={o} onDone={() => { setEditing(null); onChanged(); }} onCancel={() => setEditing(null)} />
        ) : (
          <ContactRow key={o.id} contact={o} onEdit={() => setEditing(o.id)} />
        ))}
        {editing === 'new' ? (
          <ContactForm companyId={companyId} propertyId={propertyId} onDone={() => { setEditing(null); onChanged(); }} onCancel={() => setEditing(null)} />
        ) : (
          <Button title="Add Contact" icon="plus" variant="ghost" size="sm" onPress={() => setEditing('new')} style={{ alignSelf: 'flex-start', marginTop: spacing.xs }} />
        )}
      </View>
    </>
  );
}

function ContactRow({ contact, onEdit, customer }: { contact: SnowPropertyContact; onEdit: () => void; customer?: boolean }) {
  const { colors } = useTheme();
  const reach = [contact.phone, contact.email].filter(Boolean).join(' · ');
  const tags = customer ? (contact.personId ? 'Customer account linked' : '') : [contact.isPrimary && 'Main contact'].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={customer ? `Change the customer, now ${contact.name}` : `Edit ${contact.name}`}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>
          {contact.name}{contact.title ? <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>{`, ${contact.title}`}</Text> : null}
        </Text>
        {!!reach && <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{reach}</Text>}
        {!!tags && <Text style={[typeScale.caption, { color: colors.primary }]}>{tags}</Text>}
      </View>
      <Icon name={customer ? 'repeat' : 'edit-2'} size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

function ContactForm({ companyId, propertyId, contact, makePrimary, onDone, onCancel }: {
  companyId: string; propertyId: string; contact?: SnowPropertyContact; makePrimary?: boolean;
  onDone: () => void; onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState<ContactInput>({
    name: contact?.name ?? '',
    title: contact?.title ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    personId: contact?.personId,
    isPrimary: contact?.isPrimary ?? false,
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<ContactInput>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setBusy(true);
    const res = contact ? await updateContact(contact, { ...form, personId: form.personId ?? '' }) : await addContact(companyId, propertyId, form);
    setBusy(false);
    if (!res.ok) return notify('Not Saved', res.error);
    haptics.success();
    onDone();
  }

  function remove() {
    if (!contact) return;
    confirmAction('Remove Contact', `Remove ${contact.name} from this property?${contact.personId ? ' Their customer app will stop showing it.' : ''}`, 'Remove', async () => {
      const res = await removeContact(contact.id);
      if (!res.ok) return notify('Not Removed', res.error);
      haptics.destructive();
      onDone();
    });
  }

  return (
    <View style={[styles.form, { borderColor: colors.border }]}>
      <Input label="Name" value={form.name} onChangeText={(name) => set({ name })} placeholder="Jordan Smith" autoCapitalize="words" />
      <Input label="Role (optional)" value={form.title} onChangeText={(title) => set({ title })} placeholder="Property manager" autoCapitalize="words" />
      <Input label="Phone (optional)" value={form.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" />
      <Input label="Email (optional)" value={form.email} onChangeText={(email) => set({ email })} keyboardType="email-address" autoCapitalize="none" />

      <View style={styles.formButtons}>
        {contact && <Button title="Remove" variant="ghost" size="sm" onPress={remove} />}
        <View style={{ flex: 1 }} />
        <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} />
        <Button title="Save" size="sm" loading={busy} disabled={!form.name.trim()} onPress={save} />
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.backgroundTertiary }]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[typeScale.labelSmall, { color: selected ? colors.textOnPrimary : colors.textPrimary }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ── Services ────────────────────────────────────────────────────────────────

function ServiceCard({ companyId, propertyId, service, details, mediaUrls, onChanged }: {
  companyId: string; propertyId: string; service: SnowService; details: SnowPropertyDetails;
  mediaUrls: Record<string, string>; onChanged: () => void;
}) {
  const { colors } = useTheme();
  const row = details.services.find((s) => s.service === service);
  const [busy, setBusy] = useState(false);
  const label = SNOW_SERVICE_LABELS[service];

  async function start() {
    setBusy(true);
    const res = await addService(companyId, propertyId, service, row);
    setBusy(false);
    if (!res.ok) return notify('Not Saved', res.error);
    haptics.success();
    onChanged();
  }

  function stop() {
    if (!row) return;
    confirmAction(
      `Stop ${label}`,
      `New storms won't offer ${label.toLowerCase()} here. Its instructions and media are kept, and past visits still show them.`,
      'Stop Service',
      async () => {
        const res = await setServiceActive(row.id, false);
        if (!res.ok) return notify('Not Saved', res.error);
        onChanged();
      },
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, shadow.sm]}>
      <View style={styles.serviceHeader}>
        <Icon name={SNOW_SERVICE_ICONS[service]} size={18} color={row?.isActive ? colors.primary : colors.textTertiary} />
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700', flex: 1 }]}>{label}</Text>
        {row?.isActive ? (
          <Button title="Stop" variant="ghost" size="sm" onPress={stop} />
        ) : (
          <Button title={row ? 'Resume' : 'Add'} icon={row ? undefined : 'plus'} variant="secondary" size="sm" loading={busy} onPress={start} />
        )}
      </View>
      {!row && (
        <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>This property doesn't get {label.toLowerCase()}.</Text>
      )}
      {row && !row.isActive && (
        <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>
          Stopped{row.deactivatedAt ? ` ${formatDate(row.deactivatedAt)}` : ''}. Its instructions and media are kept.
        </Text>
      )}
      {row?.isActive && (
        <ServiceReferenceEditor companyId={companyId} ps={row} details={details} mediaUrls={mediaUrls} onChanged={onChanged} />
      )}
    </View>
  );
}

function ServiceReferenceEditor({ companyId, ps, details, mediaUrls, onChanged }: {
  companyId: string; ps: SnowPropertyService; details: SnowPropertyDetails;
  mediaUrls: Record<string, string>; onChanged: () => void;
}) {
  const { colors } = useTheme();
  const current = referenceAsOf(details, ps);
  const versions = details.instructions.filter((i) => i.propertyServiceId === ps.id);
  const [text, setText] = useState(current.instructions?.body ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const items = useMemo(() => snowMediaItems(current.media, mediaUrls), [current.media, mediaUrls]);
  const removed = details.media.filter((m) => m.propertyServiceId === ps.id && m.retiredAt).length;
  const changed = text.trim() !== (current.instructions?.body ?? '').trim();

  // Pick up a version saved elsewhere, unless the owner is mid-edit.
  const latestId = current.instructions?.id;
  useEffect(() => {
    if (!changed) setText(current.instructions?.body ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId]);

  async function save() {
    setSaving(true);
    const res = await saveInstructions(companyId, ps.id, text, current.instructions);
    setSaving(false);
    if (!res.ok) return notify('Not Saved', res.error);
    haptics.success();
    onChanged();
  }

  async function add() {
    const drafts = await pickSnowMedia();
    if (drafts.length === 0) return;
    setUploading(drafts.length);
    const { saved, errors } = await addReferenceMedia(companyId, ps.id, drafts);
    setUploading(0);
    if (saved.length > 0) haptics.success();
    if (errors.length > 0) {
      notify(errors.length === 1 ? 'A file wasn\'t saved' : `${errors.length} files weren't saved`, errors[0]);
    }
    onChanged();
  }

  function retire(mediaId: string) {
    confirmAction(
      'Remove From Reference',
      'Crews won\'t see it on future storms. Visits already done with it keep it in their history.',
      'Remove',
      async () => {
        const res = await retireReferenceMedia(mediaId);
        if (!res.ok) return notify('Not Removed', res.error);
        haptics.destructive();
        onChanged();
      },
    );
  }

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      <Text style={[typeScale.labelSmall, { color: colors.textSecondary }]}>Instructions</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Where to push snow, what to avoid, gates, ramps, drains…"
        placeholderTextColor={colors.textTertiary}
        multiline
        textAlignVertical="top"
        accessibilityLabel={`${SNOW_SERVICE_LABELS[ps.service]} instructions`}
        style={[styles.instructions, typeScale.bodyLarge, { color: colors.textPrimary, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
      />
      <View style={styles.versionRow}>
        <Text style={[typeScale.caption, { color: colors.textTertiary, flex: 1 }]}>
          {current.instructions
            ? `Version ${current.instructions.version}, saved ${formatDate(current.instructions.createdAt)}`
            : 'Not saved yet'}
        </Text>
        <Button title="Save" size="sm" loading={saving} disabled={!changed} onPress={save} />
      </View>
      {versions.length > 1 && (
        <Pressable onPress={() => setShowHistory((s) => !s)} accessibilityRole="button" style={styles.historyToggle}>
          <Icon name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          <Text style={[typeScale.labelSmall, { color: colors.textSecondary }]}>
            {showHistory ? 'Hide' : 'Show'} earlier versions ({versions.length - 1})
          </Text>
        </Pressable>
      )}
      {showHistory && versions.slice(1).map((v) => (
        <View key={v.id} style={[styles.oldVersion, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Version {v.version}, {formatDate(v.createdAt)}</Text>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{v.body || '(empty)'}</Text>
        </View>
      ))}

      <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>Reference photos and videos</Text>
      <TaskMediaStrip
        items={items}
        onOpen={setOpen}
        onAdd={uploading ? undefined : add}
        onRemove={retire}
      />
      {uploading > 0 && (
        <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
          Uploading {uploading === 1 ? '1 file' : `${uploading} files`}…
        </Text>
      )}
      <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
        Shown to the route lead for {SNOW_SERVICE_LABELS[ps.service].toLowerCase()} only. Not shared with the customer.
        {removed > 0 ? ` ${removed} removed ${removed === 1 ? 'item is' : 'items are'} kept for past visits.` : ''}
      </Text>
      <TaskMediaViewer items={items} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 52 },
  screen: { flex: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.xs, marginLeft: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  form: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginVertical: spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, minHeight: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, maxWidth: 220, minHeight: 36, justifyContent: 'center' },
  formButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  instructions: { minHeight: 110, borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md },
  versionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, minHeight: 36 },
  oldVersion: { borderRadius: radius.md, padding: spacing.md, gap: 2 },
});
