import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Switch } from '@/components/ui/Switch';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { Avatar, ScreenHeader, GlassIconButton, SegmentedTabs, PressableScale, FadeInItem, IconTile } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { useNotifications } from '@/hooks/useOperations';
import { EVENT_LABELS, ALL_EVENTS } from '@/lib/notificationEvents';
import { db, useDb } from '@/data/store';

type Tab = 'defaults' | 'overrides';

export default function NotificationPreferencesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { preferences, getCompanyDefault, getWorkerOverride, updatePreference, setWorkerOverride } = useNotifications();

  const [tab, setTab] = useState<Tab>('defaults');
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);

  useDb();
  const workers = db.members.filter((m) => m.role === 'worker' && m.status === 'active' && !!m.person);

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader
        title="Notifications"
        subtitle="What gets sent, and to whom"
        right={
          <GlassIconButton
            icon="bell"
            onPress={() => router.push('/(owner)/notification-center' as any)}
            accessibilityLabel="Notification history"
          />
        }
      />

      <SegmentedTabs
        options={[
          { value: 'defaults' as Tab, label: 'Company Defaults' },
          { value: 'overrides' as Tab, label: 'Worker Overrides' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'defaults' && (
          <>
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              These are the default notification settings for all workers. You can override these per-worker in the Overrides tab.
            </Text>
            <FadeInItem style={[styles.group, { backgroundColor: colors.surface }]}>
            {ALL_EVENTS.map((eventType, i) => {
              const pref = getCompanyDefault(eventType);
              const info = EVENT_LABELS[eventType];
              const enabled = pref?.enabled ?? true;
              return (
                <View key={eventType} style={[styles.prefRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}>
                  <IconTile name={info.icon} size={32} muted={!enabled} />
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
            </FadeInItem>
          </>
        )}

        {tab === 'overrides' && !selectedWorker && (
          <>
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Select a worker to set notification overrides that differ from company defaults.
            </Text>
            <FadeInItem style={[styles.group, { backgroundColor: colors.surface }]}>
            {workers.map((m, i) => {
              const overrideCount = preferences.filter((p) => p.personId === m.personId).length;
              return (
                <PressableScale
                  key={m.personId}
                  style={[styles.workerRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
                  scaleTo={0.98}
                  onPress={() => setSelectedWorker(m.personId)}
                  accessibilityRole="button"
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
                </PressableScale>
              );
            })}
            </FadeInItem>
          </>
        )}

        {tab === 'overrides' && selectedWorker && (
          <>
            <PressableScale
              style={styles.backLink}
              onPress={() => setSelectedWorker(null)}
              accessibilityRole="button"
            >
              <Icon name="arrow-left" size={16} color={colors.primary} />
              <Text style={[typeScale.labelSmall, { color: colors.primary }]}>All Workers</Text>
            </PressableScale>
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
            <FadeInItem style={[styles.group, { backgroundColor: colors.surface }]}>
            {ALL_EVENTS.map((eventType, i) => {
              const companyDefault = getCompanyDefault(eventType);
              const override = getWorkerOverride(selectedWorker, eventType);
              const info = EVENT_LABELS[eventType];
              const defaultEnabled = companyDefault?.enabled ?? true;
              const currentEnabled = override?.enabled ?? defaultEnabled;
              const hasOverride = override !== undefined;
              return (
                <View key={eventType} style={[styles.prefRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}>
                  <IconTile name={info.icon} size={32} muted={!currentEnabled} />
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
            </FadeInItem>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing['5xl'] },
  group: {
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
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
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  prefInfo: { flex: 1 },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  workerInfo: { flex: 1 },
  backLink: {
    alignSelf: 'flex-start',
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
