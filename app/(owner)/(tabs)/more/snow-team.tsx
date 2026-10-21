/**
 * Snow Team (owner)
 *
 * Who is on the snow team and which services each person works. Workers are added from your team (no codes, no requests). Functional layout only; the approved Snow
 * Mode design will restyle it later.
 *
 * Everything here goes through the database functions in
 * supabase/updates/023_snow_onboarding.sql (owner/admin only).
 */

import React, { useMemo, useRef, useState } from 'react';
import { SERVICE_LABEL } from '@/data/snowStorms';
import { View, Text, ScrollView, StyleSheet, Platform, Alert, Pressable, Share, RefreshControl } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { ScreenHeader, ListSection, Avatar, Button, InlineNotice, StatusBadge, LoadingSpinner, Icon } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';
import { db, useDb } from '@/data/store';
import { pageOf, workersToOfferSnow } from '@/lib/snowTeam';
import {
  useSnowOnboardingAdmin,
  SNOW_SERVICES,
  snowServiceLabel,
  type SnowAccessRequest,
  type SnowMember,
  type SnowService,
} from '@/hooks/useSnowOnboarding';

function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

function showError(message: string) {
  if (Platform.OS === 'web') alert(message);
  else Alert.alert('Couldn’t save', message);
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Tap-to-toggle service chips. */
function ServicePicker({ value, onChange }: { value: SnowService[]; onChange: (v: SnowService[]) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chips}>
      {SNOW_SERVICES.map((s) => {
        const on = value.includes(s.key);
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(on ? value.filter((x) => x !== s.key) : [...value, s.key])}
            style={[
              styles.chip,
              { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySurface : colors.surface },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={s.label}
          >
            {on && <Icon name="check" size={14} color={colors.primary} />}
            <Text style={[typeScale.labelSmall, { color: on ? colors.primary : colors.textPrimary }]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PersonLine({ first, last, email, phone, avatarUrl, note }: {
  first: string; last: string; email: string; phone?: string; avatarUrl?: string; note?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.personRow}>
      <Avatar firstName={first} lastName={last} uri={avatarUrl} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{first} {last}</Text>
        <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{email}{phone ? ` · ${phone}` : ''}</Text>
        {note ? <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{note}</Text> : null}
      </View>
    </View>
  );
}

function ExistingWorkerCard({ first, last, email, phone, onGrant }: {
  first: string; last: string; email: string; phone?: string;
  onGrant: (s: SnowService[]) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [services, setServices] = useState<SnowService[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <PersonLine first={first} last={last} email={email} phone={phone} note="On the landscaping team" />
      <ServicePicker value={services} onChange={setServices} />
      <View style={styles.actionsRow}>
        <Button
          title="Save Snow access"
          size="sm"
          icon="check"
          disabled={services.length === 0}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try { await onGrant(services); } finally { setBusy(false); }
          }}
        />
      </View>
      {services.length === 0 && (
        <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>Pick at least one service, then tap Save.</Text>
      )}
    </View>
  );
}

function MemberCard({ member, onSave, onRevoke }: {
  member: SnowMember;
  onSave: (s: SnowService[]) => Promise<void>;
  onRevoke: () => void;
}) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [services, setServices] = useState<SnowService[]>(member.services);
  const [busy, setBusy] = useState(false);
  const revoked = member.status === 'revoked';
  const note = revoked
    ? `Access removed ${formatDate(member.revokedAt)}`
    : member.services.map(snowServiceLabel).join(', ') + (member.landscapingRole ? ' · Also landscaping' : '');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.memberTop}>
        <View style={{ flex: 1 }}>
          <PersonLine first={member.firstName} last={member.lastName} email={member.email} phone={member.phone} avatarUrl={member.avatarUrl} note={note} />
        </View>
        {revoked && <StatusBadge label="Removed" status="neutral" />}
      </View>
      {editing ? (
        <>
          <ServicePicker value={services} onChange={setServices} />
          <View style={styles.actionsRow}>
            <Button
              title={revoked ? 'Restore Access' : 'Save'}
              size="sm"
              icon="check"
              disabled={services.length === 0}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try { await onSave(services); setEditing(false); } finally { setBusy(false); }
              }}
            />
            <Button title="Cancel" size="sm" variant="ghost" onPress={() => { setServices(member.services); setEditing(false); }} />
          </View>
        </>
      ) : (
        <View style={styles.actionsRow}>
          <Button title={revoked ? 'Restore…' : 'Change Services'} size="sm" variant="secondary" icon="sliders" onPress={() => setEditing(true)} />
          {!revoked && <Button title="Remove Access" size="sm" variant="ghost" onPress={onRevoke} />}
        </View>
      )}
    </View>
  );
}

/** Also the Snow Mode Team tab (`asTab`: no back button, clears the tab bar). */
export function SnowTeamScreen({ asTab = false }: { asTab?: boolean }) {
  const tabBarClearance = useTabBarClearance();
  const { colors } = useTheme();
  const admin = useSnowOnboardingAdmin();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddWorkers, setShowAddWorkers] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A green note at the top so it is clear the change went through (the card itself moves away). */
  function flashSaved(message: string) {
    setSavedNote(message);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedNote(null), 5000);
  }
  const dbVersion = useDb();

  const active = admin.members.filter((m) => m.status === 'active');
  const revoked = admin.members.filter((m) => m.status === 'revoked');
  const offerWorkers = useMemo(
    () => workersToOfferSnow(db.members, admin.members),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dbVersion, admin.members],
  );

  async function run(p: Promise<{ ok: boolean; error?: string }>, success?: () => void) {
    const res = await p;
    if (res.ok) {
      success?.();
    } else {
      showError((res as { error: string }).error);
    }
  }

  function handleRevoke(m: SnowMember) {
    confirmAction(
      `Remove ${m.firstName}'s snow access?`,
      m.landscapingRole ? 'They keep their landscaping access. You can restore snow access later.' : 'They can no longer open anything on the snow side. You can restore it later.',
      'Remove Access',
      () => run(admin.revoke(m)),
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title="Snow Team" subtitle="Who works on snow, and which services" hideBack={asTab} />
      <ScrollView
        // Always clear the floating tab bar (also when opened from More), so the last row can be reached.
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance + spacing.lg }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await admin.reload(); setRefreshing(false); }} />}
      >
        {savedNote ? <InlineNotice icon="check-circle" tone="success" text={savedNote} style={{ marginBottom: spacing.md }} /> : null}
        {admin.loading ? (
          <LoadingSpinner />
        ) : admin.loadError ? (
          <View style={{ gap: spacing.md }}>
            <InlineNotice icon="alert-circle" tone="error" text={admin.loadError} />
            <Button title="Try Again" variant="secondary" icon="refresh-cw" onPress={admin.reload} />
          </View>
        ) : (
          <>
            {/* Team */}
            <Text style={[typeScale.overline, styles.sectionTitle, { color: colors.textTertiary }]}>
              SNOW TEAM{active.length ? ` (${active.length})` : ''}
            </Text>
            {active.length === 0 ? (
              <Text style={[typeScale.bodySmall, styles.empty, { color: colors.textSecondary }]}>Nobody has snow access yet.</Text>
            ) : (
              active.map((m) => (
                <MemberCard key={m.personId} member={m} onSave={(s) => run(admin.setServices(m, s), () => { haptics.success(); flashSaved(`Saved. ${m.firstName}'s Snow services were updated.`); })} onRevoke={() => handleRevoke(m)} />
              ))
            )}
            {revoked.map((m) => (
              <MemberCard key={m.personId} member={m} onSave={(s) => run(admin.setServices(m, s))} onRevoke={() => handleRevoke(m)} />
            ))}

            {/* Existing landscaping workers: grant Snow directly, no code or request needed */}
            {offerWorkers.length > 0 && (
              <>
                <Pressable onPress={() => setShowAddWorkers((v) => !v)} style={styles.sectionToggle} accessibilityRole="button" accessibilityState={{ expanded: showAddWorkers }}>
                  <Text style={[typeScale.overline, { color: colors.textTertiary, flex: 1 }]}>ADD FROM YOUR LANDSCAPING TEAM ({offerWorkers.length})</Text>
                  <Icon name={showAddWorkers ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
                </Pressable>
                {showAddWorkers && offerWorkers.map((w) => (
                  <ExistingWorkerCard
                    key={w.personId}
                    first={w.person!.firstName}
                    last={w.person!.lastName}
                    email={w.person!.email}
                    phone={w.person!.phone}
                    onGrant={(svc) => run(admin.grantAccess({ personId: w.personId, firstName: w.person!.firstName, lastName: w.person!.lastName, email: w.person!.email, phone: w.person!.phone }, svc), () => { haptics.success(); flashSaved(`Saved. ${w.person!.firstName} ${w.person!.lastName} now has Snow access (${svc.map((s) => SERVICE_LABEL[s] ?? s).join(', ')}).`); })}
                  />
                ))}
                {!showAddWorkers && (
                  <Text style={[typeScale.caption, styles.empty, { color: colors.textSecondary }]}>
                    They keep the same account and their landscaping access. You choose which snow services they can work.
                  </Text>
                )}
              </>
            )}

          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  codeBlock: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.md },
  empty: { marginLeft: spacing.md },
  card: { borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, minHeight: 36,
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  historyToggle: { paddingVertical: spacing.md, marginLeft: spacing.md },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm, marginHorizontal: spacing.md },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

export default function SnowTeamRoute() {
  return <SnowTeamScreen />;
}
