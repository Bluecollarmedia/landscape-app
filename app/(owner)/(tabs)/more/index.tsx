import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useAuth } from '@/providers/AuthProvider';
import { Avatar } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { semantic } from '@/theme/colors';

interface MenuItemProps {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  colors: any;
}

function MenuItem({ icon, label, subtitle, onPress, colors }: MenuItemProps) {
  return (
    <Pressable
      style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.primarySurface }]}>
        <Icon name={icon as any} size={20} color={colors.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]}>{label}</Text>
        {subtitle && (
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const { colors } = useTheme();
  const tabBarClearance = useTabBarClearance();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance + spacing.lg }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>More</Text>
        </View>

        <Pressable
          style={styles.profileCard}
          onPress={() => router.push('/(owner)/edit-profile' as any)}
          accessibilityRole="button"
          accessibilityLabel="Edit profile and photo"
        >
          <View>
            <Avatar
              firstName={user?.firstName ?? 'O'}
              lastName={user?.lastName ?? 'W'}
              size={56}
              uri={user?.avatarUrl}
            />
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <Feather name="camera" size={11} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
            <Text style={[typeScale.caption, { color: colors.primary, fontWeight: '600', marginTop: 2 }]}>
              Edit Profile
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>

        <View style={styles.menuSection}>
          <Text style={[typeScale.overline, { color: colors.textTertiary, marginBottom: spacing.sm, paddingHorizontal: spacing.lg }]}>
            MANAGE
          </Text>
          <MenuItem
            icon="file-text"
            label="Quotes & Invoices"
            subtitle="Quotes, change orders and invoices"
            onPress={() => router.push('/(owner)/more/financials' as any)}
            colors={colors}
          />
          <MenuItem
            icon="truck"
            label="Trucks"
            subtitle="Vehicles and equipment"
            onPress={() => router.push('/(owner)/more/trucks' as any)}
            colors={colors}
          />
          <MenuItem
            icon="key"
            label="Company Resources"
            subtitle="Codes and info, and who can see them"
            onPress={() => router.push('/(owner)/resources' as any)}
            colors={colors}
          />
          <MenuItem
            icon="volume-2"
            label="Announcements"
            subtitle="Company-wide messages"
            onPress={() => router.push('/(owner)/more/announcements' as any)}
            colors={colors}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={[typeScale.overline, { color: colors.textTertiary, marginBottom: spacing.sm, paddingHorizontal: spacing.lg }]}>
            TEAM
          </Text>
          <MenuItem
            icon="user-plus"
            label="Add Worker"
            subtitle="Invite or share team code"
            onPress={() => router.push('/(owner)/worker-new' as any)}
            colors={colors}
          />
          <MenuItem
            icon="inbox"
            label="Pending Requests"
            subtitle="Review join requests"
            onPress={() => router.push('/(owner)/more/pending-requests' as any)}
            colors={colors}
          />
          <MenuItem
            icon="sliders"
            label="Join Settings"
            subtitle="Team code and invitation settings"
            onPress={() => router.push('/(owner)/more/join-settings' as any)}
            colors={colors}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={[typeScale.overline, { color: colors.textTertiary, marginBottom: spacing.sm, paddingHorizontal: spacing.lg }]}>
            SCHEDULE
          </Text>
          <MenuItem
            icon="calendar"
            label="Schedule"
            subtitle="Daily and weekly planning"
            onPress={() => router.push('/(owner)/more/schedule' as any)}
            colors={colors}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={[typeScale.overline, { color: colors.textTertiary, marginBottom: spacing.sm, paddingHorizontal: spacing.lg }]}>
            OPERATIONS
          </Text>
          <MenuItem
            icon="clock"
            label="Hours"
            subtitle="Worker hours and time tracking"
            onPress={() => router.push('/(owner)/more/hours' as any)}
            colors={colors}
          />
          <MenuItem
            icon="dollar-sign"
            label="Payroll Estimate"
            subtitle="Weekly pay estimates"
            onPress={() => router.push('/(owner)/more/payroll' as any)}
            colors={colors}
          />
          <MenuItem
            icon="user-check"
            label="Attendance"
            subtitle="Check-ins and status"
            onPress={() => router.push('/(owner)/more/attendance' as any)}
            colors={colors}
          />
          <MenuItem
            icon="bell"
            label="Notifications"
            subtitle="Preferences and feed"
            onPress={() => router.push('/(owner)/more/notifications' as any)}
            colors={colors}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={[typeScale.overline, { color: colors.textTertiary, marginBottom: spacing.sm, paddingHorizontal: spacing.lg }]}>
            ACCOUNT
          </Text>
          <MenuItem
            icon="hard-drive"
            label="Storage"
            subtitle="Usage, quotas, and file management"
            onPress={() => router.push('/(owner)/more/storage' as any)}
            colors={colors}
          />
          <MenuItem
            icon="settings"
            label="Settings"
            subtitle="Company and app settings"
            onPress={() => router.push('/(owner)/more/settings' as any)}
            colors={colors}
          />
        </View>

        <Pressable
          style={[styles.signOut, { backgroundColor: colors.surface }]}
          onPress={signOut}
        >
          <Icon name="log-out" size={18} color={semantic.error} />
          <Text style={[typeScale.labelLarge, { color: semantic.error }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: spacing['5xl'] },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing['2xl'],
    gap: spacing.md,
  },
  profileInfo: { flex: 1 },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSection: { marginBottom: spacing.xl },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    ...shadow.sm,
  },
});
