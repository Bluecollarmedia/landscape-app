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

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Alert, Pressable, Share, RefreshControl } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/providers/ThemeProvider';
import { ScreenHeader, ListSection, Avatar, Button, InlineNotice, StatusBadge, LoadingSpinner, Icon } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';
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

export default function SnowTeamScreen() {
  const { colors } = useTheme();
  const admin = useSnowOnboardingAdmin();
  const [showHistory, setShowHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const history = admin.requests.filter((r) => r.status === 'declined' || r.status === 'removed' || r.status === 'approved');
  const active = admin.members.filter((m) => m.status === 'active');
  const revoked = admin.members.filter((m) => m.status === 'revoked');

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
      <ScreenHeader title="Snow Team" subtitle="Snow code, requests and access" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await admin.reload(); setRefreshing(false); }} />}
      >
        {admin.loading ? (
          <LoadingSpinner />
        ) : admin.loadError ? (
          <View style={{ gap: spacing.md }}>
            <InlineNotice icon="alert-circle" tone="error" text={admin.loadError} />
            <Button title="Try Again" variant="secondary" icon="refresh-cw" onPress={admin.reload} />
          </View>
        ) : (
          <>
            {/* Code */}
            <ListSection title="SNOW SIGNUP CODE" footer="Separate from your landscaping team code. A code only sends a request; nobody gets in until you approve them.">
              <View style={styles.codeBlock}>
                {admin.code ? (
                  <>
                    <Text selectable style={[typeScale.displaySmall, { color: colors.textPrimary, letterSpacing: 2 }]}>{admin.code}</Text>
                    <View style={styles.actionsRow}>
                      <Button title={copied ? 'Copied' : 'Copy'} size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} onPress={handleCopy} />
                      <Button title="Share" size="sm" variant="secondary" icon="share" onPress={handleShare} />
                      <Button title="New Code" size="sm" variant="ghost" icon="refresh-cw" onPress={handleRegenerate} />
                      <Button title="Turn Off" size="sm" variant="ghost" onPress={handleDisable} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>No Snow code is on. Nobody can send a new snow request.</Text>
                    <View style={styles.actionsRow}>
                      <Button title="Make a Snow Code" size="sm" icon="plus" onPress={handleRegenerate} />
                    </View>
                  </>
                )}
              </View>
            </ListSection>

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
                  onApprove={(s) => run(admin.approve(r, s), () => haptics.success())}
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
                <MemberCard key={m.personId} member={m} onSave={(s) => run(admin.setServices(m, s))} onRevoke={() => handleRevoke(m)} />
              ))
            )}
            {revoked.map((m) => (
              <MemberCard key={m.personId} member={m} onSave={(s) => run(admin.setServices(m, s))} onRevoke={() => handleRevoke(m)} />
            ))}

            {/* History */}
            {history.length > 0 && (
              <Pressable onPress={() => setShowHistory((v) => !v)} style={styles.historyToggle} accessibilityRole="button">
                <Text style={[typeScale.labelSmall, { color: colors.primary }]}>
                  {showHistory ? 'Hide past requests' : `Show past requests (${history.length})`}
                </Text>
              </Pressable>
            )}
            {showHistory &&
              history.map((r) => (
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
});
