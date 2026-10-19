import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Switch } from '@/components/ui/Switch';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { Card, ScreenHeader, PressableScale } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { brand, semantic } from '@/theme/colors';
import { useTeamCode, useJoinSettings, useJoinRequests, useInvitations } from '@/hooks/useOnboarding';

export default function JoinSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { activeCode, regenerateCode } = useTeamCode();
  const { settings, updateSettings } = useJoinSettings();
  const { pendingRequests } = useJoinRequests();
  const { pendingInvitations } = useInvitations();
  const [justRegenerated, setJustRegenerated] = useState(false);
  const spin = useSharedValue(0);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  function handleRegenerate() {
    if (Platform.OS === 'web') {
      if (!confirm('Regenerate the team code? The current code will immediately stop working for new requests.')) return;
    }
    spin.value = withTiming(spin.value + 360, { duration: 600, easing: Easing.out(Easing.cubic) });
    regenerateCode();
    setJustRegenerated(true);
    setTimeout(() => setJustRegenerated(false), 3000);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title="Join Settings" subtitle="How new people join your team" />

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
            />
          </View>

          {settings.joinByCodeEnabled && activeCode && (
            <>
              <Animated.View key={activeCode.code} style={styles.codeShadow}>
                <LinearGradient
                  colors={[brand.primaryDark, brand.primary, brand.primaryLight]}
                  locations={[0, 0.6, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.codeBox}
                >
                  <Text style={[typeScale.overline, { color: 'rgba(255,255,255,0.8)' }]}>CURRENT CODE</Text>
                  <Text style={[typeScale.displaySmall, styles.codeText]}>
                    {activeCode.code}
                  </Text>
                </LinearGradient>
              </Animated.View>

              {justRegenerated && (
                <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOut} style={[styles.successBanner, { backgroundColor: semantic.successLight }]}>
                  <Icon name="check-circle" size={16} color={semantic.success} />
                  <Text style={[typeScale.caption, { color: semantic.success, marginLeft: spacing.sm }]}>
                    New code generated! Previous code is now inactive.
                  </Text>
                </Animated.View>
              )}

              <PressableScale
                style={[styles.regenBtn, { backgroundColor: colors.primarySurface }]}
                scaleTo={0.95}
                haptic="light"
                onPress={handleRegenerate}
                accessibilityRole="button"
                accessibilityLabel="Regenerate code"
              >
                <Animated.View style={spinStyle}>
                  <Icon name="refresh-cw" size={16} color={colors.primaryDark} />
                </Animated.View>
                <Text style={[typeScale.labelSmall, { color: colors.primaryDark, marginLeft: spacing.sm }]}>
                  Regenerate Code
                </Text>
              </PressableScale>
              <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                This will deactivate the current code. Already approved workers are not affected.
              </Text>
            </>
          )}
        </Card>

        {/* Maintenance customer codes live on each property */}
        <Card title="Maintenance Customer Codes" style={styles.card}>
          <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
            Maintenance customers join with a code for their own property, not the team code above.
          </Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Open a property to see, copy or replace its code.
          </Text>
          <PressableScale
            onPress={() => router.push('/(owner)/(tabs)/maintenance/properties' as any)}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}
            accessibilityRole="button"
            accessibilityLabel="Open maintenance properties"
          >
            <Icon name="home" size={16} color={colors.primary} />
            <Text style={[typeScale.labelSmall, { color: colors.primary, marginLeft: spacing.sm }]}>Open maintenance properties</Text>
          </PressableScale>
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
            />
          </View>
        </Card>

        {/* Quick Stats */}
        <Card title="Overview" style={styles.card}>
          <PressableScale
            style={[styles.overviewRow, { borderBottomColor: colors.borderLight }]}
            scaleTo={0.98}
            onPress={() => router.push('/(owner)/more/pending-requests' as any)}
            accessibilityRole="button"
          >
            <Icon name="user-plus" size={16} color={semantic.warning} />
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
              Pending Requests
            </Text>
            <Text style={[typeScale.labelSmall, { color: pendingRequests.length > 0 ? semantic.warning : colors.textTertiary }]}>
              {pendingRequests.length}
            </Text>
            <Icon name="chevron-right" size={16} color={colors.textTertiary} style={{ marginLeft: spacing.sm }} />
          </PressableScale>
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  card: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    ...Platform.select({
      android: { elevation: 2 },
      default: {
        shadowColor: '#1B3A2D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
    }),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  codeShadow: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      android: { elevation: 5 },
      default: {
        shadowColor: brand.primaryDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 14,
      },
    }),
  },
  codeBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  codeText: { color: '#FFFFFF', letterSpacing: 4, marginTop: spacing.xs },
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
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
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
