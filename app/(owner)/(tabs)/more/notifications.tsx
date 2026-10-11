import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Switch } from '@/components/ui/Switch';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { Avatar } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { useNotifications } from '@/hooks/useOperations';
import { EVENT_LABELS, ALL_EVENTS } from '@/lib/notificationEvents';
import { db, useDb } from '@/data/store';

type Tab = 'defaults' | 'overrides';

export default function NotificationPreferencesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { preferences, getCompanyDefault, getWorkerOverride, updatePreference, setWorkerOverride } = useNotifications();

  const [tab, setTab] = useState<Tab>('defaults');
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);

  useDb();
  const workers = db.members.filter((m) => m.role === 'worker' && m.status === 'active' && !!m.person);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderLight }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
          Notifications
        </Text>
        <Pressable onPress={() => router.push('/(owner)/notification-center' as any)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Notification history">
          <Icon name="bell" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.borderLight }]}>
        <Pressable
          style={[styles.tab, tab === 'defaults' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('defaults')}
        >
          <Text style={[typeScale.labelSmall, { color: tab === 'defaults' ? colors.primary : colors.textSecondary }]}>
            Company Defaults
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'overrides' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('overrides')}
        >
          <Text style={[typeScale.labelSmall, { color: tab === 'overrides' ? colors.primary : colors.textSecondary }]}>
            Worker Overrides
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'defaults' && (
          <>
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              These are the default notification settings for all workers. You can override these per-worker in the Overrides tab.
            </Text>
            {ALL_EVENTS.map((eventType) => {
              const pref = getCompanyDefault(eventType);
              const info = EVENT_LABELS[eventType];
              const enabled = pref?.enabled ?? true;
              return (
                <View key={eventType} style={[styles.prefRow, { borderBottomColor: colors.borderLight }]}>
                  <View style={[styles.prefIcon, { backgroundColor: enabled ? colors.primarySurface : colors.backgroundSecondary }]}>
                    <Icon name={info.icon as any} size={16} color={enabled ? colors.primary : colors.textTertiary} />
                  </View>
                  <View style={styles.prefInfo}>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{info.label}</Text>
                    <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{info.description}</Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(val) => {
                      if (pref) updatePreference(pref.id, val);
                    }}
                  />
                </View>
              );
            })}
          </>
        )}

        {tab === 'overrides' && !selectedWorker && (
          <>
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Select a worker to set notification overrides that differ from company defaults.
            </Text>
            {workers.map((m) => {
              const overrideCount = preferences.filter((p) => p.personId === m.personId).length;
              return (
                <Pressable
                  key={m.personId}
                  style={[styles.workerRow, { borderBottomColor: colors.borderLight }]}
                  onPress={() => setSelectedWorker(m.personId)}
                >
                  <Avatar firstName={m.person!.firstName} lastName={m.person!.lastName} size={36} uri={m.person!.avatarUrl} />
                  <View style={styles.workerInfo}>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                      {m.person!.firstName} {m.person!.lastName}
                    </Text>
                    {overrideCount > 0 && (
                      <Text style={[typeScale.caption, { color: colors.primary }]}>
                        {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                </Pressable>
              );
            })}
          </>
        )}

        {tab === 'overrides' && selectedWorker && (
          <>
            <Pressable
              style={styles.backLink}
              onPress={() => setSelectedWorker(null)}
            >
              <Icon name="arrow-left" size={16} color={colors.primary} />
              <Text style={[typeScale.labelSmall, { color: colors.primary }]}>All Workers</Text>
            </Pressable>
            {(() => {
              const w = workers.find((m) => m.personId === selectedWorker);
              return (
                <View style={[styles.workerHeader, { borderBottomColor: colors.borderLight }]}>
                  <Avatar firstName={w?.person?.firstName ?? '?'} lastName={w?.person?.lastName ?? '?'} size={40} uri={w?.person?.avatarUrl} />
                  <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>
                    {w?.person?.firstName} {w?.person?.lastName}
                  </Text>
                </View>
              );
            })()}
            {ALL_EVENTS.map((eventType) => {
              const companyDefault = getCompanyDefault(eventType);
              const override = getWorkerOverride(selectedWorker, eventType);
              const info = EVENT_LABELS[eventType];
              const defaultEnabled = companyDefault?.enabled ?? true;
              const currentEnabled = override?.enabled ?? defaultEnabled;
              const hasOverride = override !== undefined;
              return (
                <View key={eventType} style={[styles.prefRow, { borderBottomColor: colors.borderLight }]}>
                  <View style={[styles.prefIcon, { backgroundColor: currentEnabled ? colors.primarySurface : colors.backgroundSecondary }]}>
                    <Icon name={info.icon as any} size={16} color={currentEnabled ? colors.primary : colors.textTertiary} />
                  </View>
                  <View style={styles.prefInfo}>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{info.label}</Text>
                    {hasOverride && (
                      <Text style={[typeScale.caption, { color: colors.warning }]}>
                        Override (default: {defaultEnabled ? 'ON' : 'OFF'})
                      </Text>
                    )}
                    {!hasOverride && (
                      <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                        Using default ({defaultEnabled ? 'ON' : 'OFF'})
                      </Text>
                    )}
                  </View>
                  <Switch
                    value={currentEnabled}
                    onValueChange={(val) => setWorkerOverride(selectedWorker, eventType, val)}
                  />
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  prefIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefInfo: { flex: 1 },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  workerInfo: { flex: 1 },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
  },
});
