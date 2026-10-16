import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Share } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, Input, Card } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { useTeamCode, useJoinRequests } from '@/hooks/useOnboarding';
import { inviteMessage, textInvite, copyText } from '@/lib/invite';
import { db, useDb } from '@/data/store';
import { useMaintenanceCrew } from '@/hooks/useMaintenanceCrew';
import type { WorkerType } from '@/types/maintenance';
import { haptics } from '@/lib/haptics';

export default function AddWorkerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  // Landscaping worker or maintenance worker. Each has its own code.
  const [kind, setKind] = useState<WorkerType>(params.type === 'maintenance' ? 'maintenance' : 'landscaping');
  const isMaint = kind === 'maintenance';
  const { activeCode, regenerateCode } = useTeamCode(undefined, kind);
  const { maintenanceCrew } = useMaintenanceCrew();
  const { pendingRequests } = useJoinRequests();
  useDb();

  const [invName, setInvName] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleCopyCode() {
    if (activeCode) {
      await copyText(activeCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleTextInvite() {
    if (!activeCode) return;
    const message = inviteMessage(activeCode.code, db.company?.name, invName, kind);
    await textInvite(message, invPhone);
    if (Platform.OS === 'web') {
      alert('Invite message copied. Paste it into a text to your worker.');
    }
    setInvName('');
    setInvPhone('');
  }

  function handleRegenerate() {
    if (!activeCode) {
      regenerateCode();
      return;
    }
    if (Platform.OS === 'web') {
      if (confirm('Regenerate team code? The current code will stop working for new requests.')) {
        regenerateCode();
      }
    } else {
      regenerateCode();
    }
  }



  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          {isMaint ? 'Add Maintenance Worker' : 'Add Worker'}
        </Text>
      </View>

      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Which kind of worker */}
        <View style={styles.kindRow} accessibilityRole="radiogroup">
          {([
            { value: 'landscaping' as const, title: 'Add Worker', sub: 'Landscaping projects', icon: 'tool' as const },
            { value: 'maintenance' as const, title: 'Add Maintenance Worker', sub: 'Maintenance routes', icon: 'repeat' as const },
          ]).map(o => {
            const selected = kind === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => { haptics.select(); setKind(o.value); }}
                style={[styles.kindCard, { backgroundColor: selected ? colors.primarySurface : colors.surface, borderColor: selected ? colors.primary : colors.border }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <Icon name={o.icon} size={20} color={selected ? colors.primary : colors.textSecondary} />
                <Text style={[typeScale.labelLarge, { color: colors.textPrimary, marginTop: spacing.sm }]}>{o.title}</Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{o.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        {isMaint && !maintenanceCrew && (
          <Pressable
            onPress={() => router.push('/(owner)/crews' as any)}
            style={[styles.noteBox, styles.section, { backgroundColor: semantic.warningLight, borderColor: semantic.warning }]}
            accessibilityRole="button"
          >
            <Icon name="info" size={14} color={semantic.warning} />
            <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
              You don't have a Maintenance Crew yet. Turn it on for a crew under Crews so approved maintenance workers join it.
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textTertiary} />
          </Pressable>
        )}

        {/* Invite by text */}
        <Card title="Text an Invite" style={styles.section}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            {isMaint
              ? 'Sends a text with your maintenance code. They download the app, tap Join a Team, enter the code, and you approve them as a maintenance worker.'
              : 'Sends your worker a text with the team code. They download the app, tap Join a Team, enter the code, and you approve them.'}
          </Text>
          <View style={styles.inviteForm}>
            <Input label="Name (optional)" placeholder="Worker's name" value={invName} onChangeText={setInvName} icon="user" />
            <Input label="Phone (optional)" placeholder="(555) 555-0100" value={invPhone} onChangeText={setInvPhone} keyboardType="phone-pad" icon="phone" />
            <Button title="Send Text Invite" onPress={handleTextInvite} icon="message-circle" fullWidth disabled={!activeCode} />
          </View>
        </Card>

        {/* Team Code */}
        <Card title={isMaint ? 'Maintenance Code' : 'Team Code'} style={styles.section}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            {isMaint
              ? "Share this code with maintenance workers. Their request shows up marked Maintenance, and you still approve it."
              : "Share this code with workers. They'll use it to request to join your team."}
          </Text>

          <View style={[styles.codeDisplay, { backgroundColor: colors.primarySurface }]}>
            <Text style={[typeScale.displaySmall, { color: colors.primary, fontWeight: '700', letterSpacing: 2 }]}>
              {activeCode?.code ?? '—'}
            </Text>
          </View>

          {!activeCode && isMaint && (
            <Button title="Create Maintenance Code" icon="plus" onPress={handleRegenerate} fullWidth style={{ marginBottom: spacing.md }} />
          )}

          {activeCode && (
          <View style={styles.codeActions}>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleCopyCode}>
              <Icon name={copied ? 'check' : 'copy'} size={16} color={copied ? semantic.success : colors.textSecondary} />
              <Text style={[typeScale.labelSmall, { color: copied ? semantic.success : colors.textSecondary, marginLeft: 4 }]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={async () => {
              if (!activeCode) return;
              if (Platform.OS === 'web') {
                handleCopyCode();
              } else {
                try {
                  await Share.share({ message: inviteMessage(activeCode.code, db.company?.name, undefined, kind) });
                } catch {}
              }
            }}>
              <Icon name="share-2" size={16} color={colors.textSecondary} />
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>Share</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleRegenerate}>
              <Icon name="refresh-cw" size={16} color={colors.textSecondary} />
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>Regenerate</Text>
            </Pressable>
          </View>
          )}

          <View style={[styles.noteBox, { backgroundColor: semantic.warningLight, borderColor: semantic.warning }]}>
            <Icon name="info" size={14} color={semantic.warning} />
            <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
              Anyone with this code can request to join. All requests require your approval before granting access{isMaint ? ', including maintenance workers' : ''}.
            </Text>
          </View>
        </Card>

        {/* Pending Requests */}
        <Pressable
          style={[styles.requestsLink, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={() => router.push('/(owner)/more/pending-requests' as any)}
        >
          <View style={[styles.requestsIcon, { backgroundColor: pendingRequests.length > 0 ? semantic.warningLight : colors.primarySurface }]}>
            <Icon name="user-plus" size={20} color={pendingRequests.length > 0 ? semantic.warning : colors.primary} />
          </View>
          <View style={styles.requestsText}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '500' }]}>
              Pending Requests
            </Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
              {pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''} waiting for review
            </Text>
          </View>
          {pendingRequests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: semantic.warning }]}>
              <Text style={[typeScale.caption, { color: '#FFFFFF', fontWeight: '700' }]}>{pendingRequests.length}</Text>
            </View>
          )}
          <Icon name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  section: {
    marginBottom: spacing.lg,
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kindCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    minHeight: 96,
  },
  inviteForm: {
    gap: spacing.md,
  },
  codeDisplay: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  codeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
  },
  requestsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.md,
  },
  requestsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsText: { flex: 1 },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
