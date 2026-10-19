/**
 * Snow Team (owner)
 *
 * The separate Snow signup code, Snow access requests, and who is on the
 * snow team with which services. Functional layout only; the approved Snow
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

function RequestCard({ req, onApprove, onDecline, onRemove }: {
  req: SnowAccessRequest;
  onApprove: (s: SnowService[]) => Promise<void>;
  onDecline: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const [services, setServices] = useState<SnowService[]>([]);
  const [busy, setBusy] = useState(false);
  const notes = [
    `Requested ${formatDate(req.createdAt)}`,
    req.landscapingRole ? 'Already on the landscaping team' : 'Snow only',
    req.codeStillActive ? null : 'Used an old code',
  ].filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <PersonLine first={req.firstName} last={req.lastName} email={req.email} phone={req.phone} avatarUrl={req.avatarUrl} note={notes} />
      <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginTop: spacing.md }]}>Snow work they can do</Text>
      <ServicePicker value={services} onChange={setServices} />
      <View style={styles.actionsRow}>
        <Button
          title="Approve"
          icon="check"
          size="sm"
          disabled={services.length === 0}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try { await onApprove(services); } finally { setBusy(false); }
          }}
        />
        <Button title="Decline" icon="x" size="sm" variant="secondary" onPress={onDecline} />
        <Button title="Remove" size="sm" variant="ghost" onPress={onRemove} />
      </View>
      {services.length === 0 && (
        <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>Pick at least one service to approve.</Text>
      )}
    </View>
  );
}

/** An existing landscaping worker the owner can give Snow access without a signup request. */
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
  const [showHistory, setShowHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCodeTools, setShowCodeTools] = useState(false);
  const [showAddWorkers, setShowAddWorkers] = useState(false);
  const [historyPages, setHistoryPages] = useState(1);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A green note at the top so it is clear the change went through (the card itself moves away). */
  function flashSaved(message: string) {
    setSavedNote(message);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedNote(null), 5000);
  }
  const dbVersion = useDb();

  const history = admin.requests.filter((r) => r.status === 'declined' || r.status === 'removed' || r.status === 'approved');
  const active = admin.members.filter((m) => m.status === 'active');
  const revoked = admin.members.filter((m) => m.status === 'revoked');
  const offerWorkers = useMemo(
    () => workersToOfferSnow(db.members, admin.members),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dbVersion, admin.members],
  );
  const historyPage = pageOf(history, historyPages);

  async function run(p: Promise<{ ok: boolean; error?: string }>, success?: () => void) {
    const res = await p;
    if (res.ok) {
      success?.();
    } else {
      showError((res as { error: string }).error);
    }
  }

  function handleRegenerate() {
    confirmAction(
      admin.code ? 'Make a new Snow code?' : 'Turn on the Snow code?',
      admin.code ? 'The current code stops working right away. Requests already waiting stay here for you to review.' : 'People can use the new code to ask for snow access. You still approve each one.',
      admin.code ? 'New Code' : 'Turn On',
      () => run(admin.regenerateCode(), () => haptics.success()),
    );
  }

  function handleDisable() {
    confirmAction(
      'Turn off the Snow code?',
      'Nobody can send a new snow request until you make a new code. Requests already waiting stay here.',
      'Turn Off',
      () => run(admin.disableCode()),
    );
  }

  async function handleCopy() {
    if (!admin.code) return;
    await Clipboard.setStringAsync(admin.code);
    haptics.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (!admin.code) return;
    Share.share({ message: `Join the Brighton snow team: open the Brighton Lawn + Landscape app, tap "Join the Snow Team" and enter ${admin.code}` }).catch(() => {});
  }

  function handleDecline(req: SnowAccessRequest) {
    const go = (reason?: string) => run(admin.decline(req, reason));
    if (Platform.OS === 'web') {
      const reason = prompt(`Decline ${req.firstName}'s snow request? Reason (optional):`);
      if (reason !== null) go(reason || undefined);
    } else if (Platform.OS === 'ios') {
      Alert.prompt('Decline snow request?', `${req.firstName} will see that it wasn't approved. Reason (optional):`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: (reason?: string) => go(reason || undefined) },
      ]);
    } else {
      confirmAction('Decline snow request?', `${req.firstName} will see that it wasn't approved.`, 'Decline', () => go());
    }
  }

  function handleRemove(req: SnowAccessRequest) {
    confirmAction(
      'Remove this request?',
      `Clears ${req.firstName}'s request from the list without approving it. They can ask again with the current code.`,
      'Remove',
      () => run(admin.remove(req)),
    );
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
      <ScreenHeader title="Snow Team" subtitle="Who can work snow, and who is waiting" hideBack={asTab} />
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
            {/* Requests */}
            <Text style={[typeScale.overline, styles.sectionTitle, { color: colors.textTertiary }]}>
              REQUESTS{admin.pending.length ? ` (${admin.pending.length})` : ''}
            </Text>
            {admin.pending.length === 0 ? (
              <Text style={[typeScale.bodySmall, styles.empty, { color: colors.textSecondary }]}>No snow requests waiting.</Text>
            ) : (
              admin.pending.map((r) => (
                <RequestCard
                  key={r.id}
                  req={r}
                  onApprove={(s) => run(admin.approve(r, s), () => { haptics.success(); flashSaved(`Saved. ${r.firstName} ${r.lastName} was approved for Snow.`); })}
                  onDecline={() => handleDecline(r)}
                  onRemove={() => handleRemove(r)}
                />
              ))
            )}

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

            {/* New workers: the Snow code, kept small */}
            <Text style={[typeScale.overline, styles.sectionTitle, { color: colors.textTertiary }]}>NEW WORKERS</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, paddingVertical: spacing.md }]}>
              {admin.code ? (
                <>
                  <View style={styles.codeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Snow signup code</Text>
                      <Text selectable style={[typeScale.labelLarge, { color: colors.textPrimary, letterSpacing: 1.5 }]}>{admin.code}</Text>
                    </View>
                    <Button title={copied ? 'Copied' : 'Copy'} size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} onPress={handleCopy} />
                    <Button title="Share" size="sm" variant="secondary" icon="share" onPress={handleShare} />
                  </View>
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                    For people who are not on your team yet. A code only sends a request; nobody gets in until you approve them.
                  </Text>
                  <Pressable onPress={() => setShowCodeTools((v) => !v)} style={{ marginTop: spacing.sm }} accessibilityRole="button">
                    <Text style={[typeScale.labelSmall, { color: colors.primary }]}>{showCodeTools ? 'Hide code options' : 'Code options'}</Text>
                  </Pressable>
                  {showCodeTools && (
                    <View style={styles.actionsRow}>
                      <Button title="New Code" size="sm" variant="ghost" icon="refresh-cw" onPress={handleRegenerate} />
                      <Button title="Turn Off" size="sm" variant="ghost" onPress={handleDisable} />
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.codeRow}>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary, flex: 1 }]}>No Snow code is on. Nobody new can send a request.</Text>
                  <Button title="Make a Snow Code" size="sm" icon="plus" onPress={handleRegenerate} />
                </View>
              )}
            </View>

            {/* History */}
            {history.length > 0 && (
              <Pressable onPress={() => setShowHistory((v) => !v)} style={styles.historyToggle} accessibilityRole="button">
                <Text style={[typeScale.labelSmall, { color: colors.primary }]}>
                  {showHistory ? 'Hide past requests' : `Show past requests (${history.length})`}
                </Text>
              </Pressable>
            )}
            {showHistory &&
              historyPage.shown.map((r) => (
                <View key={r.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                  <View style={styles.memberTop}>
                    <View style={{ flex: 1 }}>
                      <PersonLine
                        first={r.firstName}
                        last={r.lastName}
                        email={r.email}
                        avatarUrl={r.avatarUrl}
                        note={[
                          formatDate(r.reviewedAt ?? r.createdAt),
                          r.status === 'approved' ? r.grantedServices.map(snowServiceLabel).join(', ') : null,
                          r.declineReason ? `“${r.declineReason}”` : null,
                        ].filter(Boolean).join(' · ')}
                      />
                    </View>
                    <StatusBadge
                      label={r.status === 'approved' ? 'Approved' : r.status === 'declined' ? 'Declined' : 'Removed'}
                      status={r.status === 'approved' ? 'success' : r.status === 'declined' ? 'error' : 'neutral'}
                    />
                  </View>
                </View>
              ))}
            {showHistory && historyPage.more > 0 && (
              <Pressable onPress={() => setHistoryPages((n) => n + 1)} style={styles.historyToggle} accessibilityRole="button">
                <Text style={[typeScale.labelSmall, { color: colors.primary }]}>Show {Math.min(historyPage.more, 10)} more ({historyPage.more} left)</Text>
              </Pressable>
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
