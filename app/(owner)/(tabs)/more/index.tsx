import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useAuth } from '@/providers/AuthProvider';
import { useJoinRequests } from '@/hooks/useOnboarding';
import { Avatar, IconTile, MenuGroup, MenuRow, PressableScale, FadeInItem } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { brand, semantic } from '@/theme/colors';

interface QuickAction {
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

export default function MoreScreen() {
  const { colors } = useTheme();
  const tabBarClearance = useTabBarClearance();
  const { user, signOut, memberRole } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingRequests } = useJoinRequests();

  const go = (route: string) => router.push(route as any);

  // The four things the owner reaches for most, as big buttons up top.
  const quickActions: QuickAction[] = [
    { icon: 'calendar', label: 'Schedule', route: '/(owner)/more/schedule' },
    { icon: 'user-plus', label: 'Add worker', route: '/(owner)/worker-new' },
    { icon: 'truck', label: 'Trucks', route: '/(owner)/more/trucks' },
    { icon: 'inbox', label: 'Requests', route: '/(owner)/more/pending-requests', badge: pendingRequests.length },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(260)} style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>More</Text>
        </Animated.View>

        <FadeInItem index={0}>
          <PressableScale
            onPress={() => go('/(owner)/more/settings')}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel="Your account"
            style={styles.profileShadow}
          >
            <LinearGradient
              colors={[brand.primaryDark, brand.primary, '#7CB342']}
              locations={[0, 0.6, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCard}
            >
              <View style={styles.avatarRing}>
                <Avatar
                  firstName={user?.firstName ?? 'O'}
                  lastName={user?.lastName ?? 'W'}
                  size={52}
                  uri={user?.avatarUrl}
                />
              </View>
              <View style={styles.profileInfo}>
                <Text style={[typeScale.headingLarge, styles.onGreen]} numberOfLines={1}>
                  {user?.firstName} {user?.lastName}
                </Text>
                <Text style={[typeScale.bodySmall, styles.onGreenSoft]} numberOfLines={1}>
                  {user?.email}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.85)" />
            </LinearGradient>
          </PressableScale>
        </FadeInItem>

        <View style={styles.quickRow}>
          {quickActions.map((action, i) => (
            <FadeInItem key={action.route} index={i + 1} style={styles.quickCell}>
              <PressableScale
                onPress={() => go(action.route)}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={action.badge ? `${action.label}, ${action.badge} waiting` : action.label}
                style={[styles.quickTile, { backgroundColor: colors.surface }]}
              >
                <IconTile name={action.icon} size={40} />
                <Text style={[typeScale.caption, styles.quickLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                  {action.label}
                </Text>
                {!!action.badge && (
                  <View style={[styles.badge, { backgroundColor: colors.primaryDark, borderColor: colors.surface }]}>
                    <Text style={styles.badgeText}>{action.badge > 9 ? '9+' : action.badge}</Text>
                  </View>
                )}
              </PressableScale>
            </FadeInItem>
          ))}
        </View>

        <FadeInItem index={5}>
          <MenuGroup title="BUSINESS">
            <MenuRow icon="file-text" label="Quotes & Invoices" subtitle="Quotes, change orders and invoices" onPress={() => go('/(owner)/more/financials')} />
            <MenuRow icon="clipboard" label="Materials" subtitle="What to order or pick up for upcoming jobs" onPress={() => go('/(owner)/more/materials')} />
            <MenuRow icon="key" label="Company Resources" subtitle="Codes and info, and who can see them" onPress={() => go('/(owner)/resources')} />
            <MenuRow icon="volume-2" label="Announcements" subtitle="Company-wide messages" onPress={() => go('/(owner)/more/announcements')} />
          </MenuGroup>
        </FadeInItem>

        <FadeInItem index={6}>
          <MenuGroup title="TEAM">
            <MenuRow icon="inbox" label="Join Requests" subtitle="Approve people asking to join" count={pendingRequests.length} onPress={() => go('/(owner)/more/pending-requests')} />
            {memberRole !== 'admin' && (
              <MenuRow icon="users" label="Accounts" subtitle="Everyone who has signed up" onPress={() => go('/(owner)/more/accounts')} />
            )}
            <MenuRow icon="sliders" label="Join Settings" subtitle="Team code and invitations" onPress={() => go('/(owner)/more/join-settings')} />
            <MenuRow icon="user-check" label="Attendance" subtitle="Check-ins and status" onPress={() => go('/(owner)/more/attendance')} />
          </MenuGroup>
        </FadeInItem>

        <FadeInItem index={7}>
          <MenuGroup title="TIME & PAY">
            <MenuRow icon="clock" label="Hours" subtitle="Worker hours and time tracking" onPress={() => go('/(owner)/more/hours')} />
            <MenuRow icon="dollar-sign" label="Payroll Estimate" subtitle="Weekly pay estimates" onPress={() => go('/(owner)/more/payroll')} />
          </MenuGroup>
        </FadeInItem>

        <FadeInItem index={8}>
          <MenuGroup title="APP">
            <MenuRow icon="bell" label="Notifications" subtitle="What gets sent, and to whom" onPress={() => go('/(owner)/more/notifications')} />
            <MenuRow icon="settings" label="Settings" subtitle="Company, storage and app settings" onPress={() => go('/(owner)/more/settings')} />
          </MenuGroup>
        </FadeInItem>

        <FadeInItem index={9}>
          <PressableScale
            onPress={signOut}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={[styles.signOut, { backgroundColor: colors.surface }]}
          >
            <Icon name="log-out" size={18} color={semantic.error} />
            <Text style={[typeScale.labelLarge, { color: semantic.error }]}>Sign Out</Text>
          </PressableScale>
        </FadeInItem>
      </ScrollView>
    </View>
  );
}

const cardShadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: '#1B3A2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
})!;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {},
  header: { paddingHorizontal: spacing.lg + spacing.xs, marginBottom: spacing.md },
  profileShadow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.xl + 2,
    ...Platform.select({
      android: { elevation: 6 },
      default: {
        shadowColor: brand.primaryDark,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.32,
        shadowRadius: 18,
      },
    }),
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl + 2,
  },
  avatarRing: {
    borderRadius: 30,
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  profileInfo: { flex: 1 },
  onGreen: { color: '#FFFFFF' },
  onGreenSoft: { color: 'rgba(255,255,255,0.85)' },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  quickCell: { flex: 1 },
  quickTile: {
    alignItems: 'center',
    gap: spacing.sm - 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + 2,
    borderRadius: radius.lg + 2,
    ...cardShadow,
  },
  quickLabel: { fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg + 2,
    ...cardShadow,
  },
});
