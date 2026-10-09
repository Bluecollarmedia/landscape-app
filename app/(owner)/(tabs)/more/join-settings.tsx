import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { Card } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { useTeamCode, useJoinSettings, useJoinRequests, useInvitations } from '@/hooks/useOnboarding';

export default function JoinSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeCode, regenerateCode } = useTeamCode();
  const { settings, updateSettings } = useJoinSettings();
  const { pendingRequests } = useJoinRequests();
  const { pendingInvitations } = useInvitations();
  const [justRegenerated, setJustRegenerated] = useState(false);

  function handleRegenerate() {
    if (Platform.OS === 'web') {
      if (!confirm('Regenerate the team code? The current code will immediately stop working for new requests.')) return;
    }
    const newCode = regenerateCode();
    setJustRegenerated(true);
    setTimeout(() => setJustRegenerated(false), 3000);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          Join Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Team Code Toggle */}
        <Card title="Join by Team Code" style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                Allow workers to request access with a team code
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Workers must still be approved before gaining access
              </Text>
            </View>
            <Switch
              value={settings.joinByCodeEnabled}
              onValueChange={(v) => updateSettings({ joinByCodeEnabled: v })}
              trackColor={{ false: colors.borderLight, true: colors.primary + '60' }}
              thumbColor={settings.joinByCodeEnabled ? colors.primary : colors.textTertiary}
            />
          </View>

          {settings.joinByCodeEnabled && activeCode && (
            <>
              <View style={[styles.codeBox, { backgroundColor: colors.primarySurface }]}>
                <Text style={[typeScale.overline, { color: colors.textTertiary }]}>CURRENT CODE</Text>
                <Text style={[typeScale.headingLarge, { color: colors.primary, fontWeight: '700', letterSpacing: 2, marginTop: spacing.xs }]}>
                  {activeCode.code}
                </Text>
              </View>

              {justRegenerated && (
                <View style={[styles.successBanner, { backgroundColor: semantic.successLight }]}>
                  <Icon name="check-circle" size={16} color={semantic.success} />
                  <Text style={[typeScale.caption, { color: semantic.success, marginLeft: spacing.sm }]}>
                    New code generated! Previous code is now inactive.
                  </Text>
                </View>
              )}

              <Pressable
                style={[styles.regenBtn, { borderColor: colors.border }]}
                onPress={handleRegenerate}
              >
                <Icon name="refresh-cw" size={16} color={colors.textSecondary} />
                <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                  Regenerate Code
                </Text>
              </Pressable>
              <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                This will deactivate the current code. Already approved workers are not affected.
              </Text>
            </>
          )}
        </Card>

        {/* Direct Invitations */}
        <Card title="Direct Invitations" style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                Send email invitations to workers and customers
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Recipients must still complete their profile and be approved
              </Text>
            </View>
            <Switch
              value={settings.directInvitationsEnabled}
              onValueChange={(v) => updateSettings({ directInvitationsEnabled: v })}
              trackColor={{ false: colors.borderLight, true: colors.primary + '60' }}
              thumbColor={settings.directInvitationsEnabled ? colors.primary : colors.textTertiary}
            />
          </View>

          {pendingInvitations.length > 0 && (
            <View style={[styles.statRow, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Icon name="mail" size={16} color={colors.primary} />
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </Card>

        {/* Email Verification */}
        <Card title="Security" style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                Require email verification
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                New accounts must verify their email before joining
              </Text>
            </View>
            <Switch
              value={settings.requireEmailVerification}
              onValueChange={(v) => updateSettings({ requireEmailVerification: v })}
              trackColor={{ false: colors.borderLight, true: colors.primary + '60' }}
              thumbColor={settings.requireEmailVerification ? colors.primary : colors.textTertiary}
            />
          </View>
        </Card>

        {/* Quick Stats */}
        <Card title="Overview" style={styles.card}>
          <Pressable
            style={[styles.overviewRow, { borderBottomColor: colors.borderLight }]}
            onPress={() => router.push('/(owner)/more/pending-requests' as any)}
          >
            <Icon name="user-plus" size={16} color={semantic.warning} />
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
              Pending Requests
            </Text>
            <Text style={[typeScale.labelSmall, { color: pendingRequests.length > 0 ? semantic.warning : colors.textTertiary }]}>
              {pendingRequests.length}
            </Text>
            <Icon name="chevron-right" size={16} color={colors.textTertiary} style={{ marginLeft: spacing.sm }} />
          </Pressable>
          <View style={styles.overviewRow}>
            <Icon name="mail" size={16} color={colors.primary} />
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
              Open Invitations
            </Text>
            <Text style={[typeScale.labelSmall, { color: colors.textTertiary }]}>
              {pendingInvitations.length}
            </Text>
          </View>
        </Card>
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  card: { marginBottom: spacing.lg },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  codeBox: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.xs,
    marginBottom: spacing.md,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
});
