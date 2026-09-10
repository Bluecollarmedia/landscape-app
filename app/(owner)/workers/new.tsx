import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, Input, Card } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { useTeamCode, useJoinRequests, useInvitations } from '@/hooks/useOnboarding';

export default function AddWorkerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeCode, regenerateCode } = useTeamCode();
  const { pendingRequests } = useJoinRequests();
  const { createInvitation } = useInvitations();

  const [showInvite, setShowInvite] = useState(false);
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  async function handleCopyCode() {
    if (activeCode) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(activeCode.code);
        }
      } catch {}
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleRegenerate() {
    if (Platform.OS === 'web') {
      if (confirm('Regenerate team code? The current code will stop working for new requests.')) {
        regenerateCode();
      }
    } else {
      regenerateCode();
    }
  }

  function handleSendInvite() {
    if (!invEmail.trim() || !invEmail.includes('@')) {
      if (Platform.OS === 'web') alert('Please enter a valid email address.');
      return;
    }
    const result = createInvitation({
      email: invEmail.trim(),
      name: invName.trim() || undefined,
      phone: invPhone.trim() || undefined,
      type: 'worker',
    });
    if (result.success) {
      setInviteSent(true);
      setTimeout(() => {
        setInviteSent(false);
        setShowInvite(false);
        setInvName('');
        setInvEmail('');
        setInvPhone('');
      }, 2000);
    } else {
      if (Platform.OS === 'web') alert('An invitation has already been sent to this email.');
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          Add Worker
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Invite by Email */}
        <Card title="Invite Directly" style={styles.section}>
          {!showInvite ? (
            <Button title="Invite by Email" onPress={() => setShowInvite(true)} icon="mail" fullWidth variant="outline" />
          ) : inviteSent ? (
            <View style={[styles.successBanner, { backgroundColor: semantic.successLight }]}>
              <Feather name="check-circle" size={20} color={semantic.success} />
              <Text style={[typeScale.bodySmall, { color: semantic.success, marginLeft: spacing.sm }]}>
                Invitation sent!
              </Text>
            </View>
          ) : (
            <View style={styles.inviteForm}>
              <Input label="Name (optional)" placeholder="Worker's name" value={invName} onChangeText={setInvName} icon="user" />
              <Input label="Email *" placeholder="worker@email.com" value={invEmail} onChangeText={setInvEmail} keyboardType="email-address" autoCapitalize="none" icon="mail" />
              <Input label="Phone (optional)" placeholder="(555) 555-0100" value={invPhone} onChangeText={setInvPhone} keyboardType="phone-pad" icon="phone" />
              <View style={styles.inviteActions}>
                <Button title="Send Invitation" onPress={handleSendInvite} icon="send" size="sm" />
                <Button title="Cancel" onPress={() => setShowInvite(false)} variant="ghost" size="sm" />
              </View>
            </View>
          )}
        </Card>

        {/* Team Code */}
        <Card title="Team Code" style={styles.section}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Share this code with workers. They'll use it to request to join your team.
          </Text>

          <View style={[styles.codeDisplay, { backgroundColor: colors.primarySurface, borderColor: colors.primary }]}>
            <Text style={[typeScale.displaySmall, { color: colors.primary, fontWeight: '700', letterSpacing: 2 }]}>
              {activeCode?.code ?? '—'}
            </Text>
          </View>

          <View style={styles.codeActions}>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleCopyCode}>
              <Feather name={copied ? 'check' : 'copy'} size={16} color={copied ? semantic.success : colors.textSecondary} />
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
                  await Share.share({ message: `Join our team on Brighton Lawn + Landscape! Use team code: ${activeCode.code}` });
                } catch {}
              }
            }}>
              <Feather name="share-2" size={16} color={colors.textSecondary} />
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>Share</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleRegenerate}>
              <Feather name="refresh-cw" size={16} color={colors.textSecondary} />
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>Regenerate</Text>
            </Pressable>
          </View>

          <View style={[styles.noteBox, { backgroundColor: '#FFF8E1', borderColor: '#F9A825' }]}>
            <Feather name="info" size={14} color="#F9A825" />
            <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
              Anyone with this code can request to join. All requests require your approval before granting access.
            </Text>
          </View>
        </Card>

        {/* Pending Requests */}
        <Pressable
          style={[styles.requestsLink, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={() => router.push('/(owner)/more/pending-requests' as any)}
        >
          <View style={[styles.requestsIcon, { backgroundColor: pendingRequests.length > 0 ? semantic.warningLight : colors.primarySurface }]}>
            <Feather name="user-plus" size={20} color={pendingRequests.length > 0 ? semantic.warning : colors.primary} />
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
          <Feather name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  section: {
    marginBottom: spacing.lg,
  },
  inviteForm: {
    gap: spacing.md,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.xs,
  },
  codeDisplay: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.sm,
    borderWidth: 1,
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
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radius.xs,
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
