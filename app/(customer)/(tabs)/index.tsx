import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ScreenContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { db, useDb } from '@/data/store';
import { useMyMaintenanceProperties } from '@/data/maintenanceCustomer';
import { useMySnowProperties } from '@/hooks/useHasSnow';
import { emptyPortalText, snowCardSubtitle } from '@/lib/customerPortal';
import { meaningfulUpdates } from '@/lib/customerOverview';
import {
  buildHomeItems, COMPLETED_PREVIEW, completedToShow, filterByProperty, propertyOptions, splitHome, statusLabel,
  type HomeItem,
} from '@/lib/customerHome';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * The customer's home: their active projects first (landscaping projects, maintenance and snow properties, whichever they actually
 * have), then completed projects as a compact list. A property filter appears only when they have more than one property.
 */
export default function CustomerHomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myMaintenance = useMyMaintenanceProperties();
  const mySnow = useMySnowProperties();
  const [property, setProperty] = useState<string | null>(null);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  useDb();
  const customerProjects = db.projects.filter((p) => p.customerId === user?.id || p.customerClaimedBy === user?.id);

  const all = useMemo(
    () => buildHomeItems({
      projects: customerProjects,
      maintenance: myMaintenance,
      snow: mySnow,
      snowNote: snowCardSubtitle,
      latestUpdateFor: (id) => {
        const e = meaningfulUpdates(db.customerTimeline[id] ?? [], 1)[0];
        return e ? { title: e.title, at: e.timestamp } : undefined;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customerProjects.map((p) => `${p.id}${p.status}${p.progress}${p.updatedAt}`).join('|'), myMaintenance, mySnow],
  );

  const options = propertyOptions(all);
  // A saved filter for a property that's no longer listed is ignored rather than showing an empty screen.
  const activeProperty = options.some((o) => o.key === property) ? property : null;
  const { active, completed } = splitHome(filterByProperty(all, activeProperty));
  const shownCompleted = completedToShow(completed, showAllCompleted);

  function open(i: HomeItem) {
    if (i.kind === 'maintenance') return router.push('/(customer)/maintenance-updates' as any);
    if (i.kind === 'snow') return router.push('/(customer)/snow-updates' as any);
    router.push(`/(customer)/project?id=${i.key.slice('project:'.length)}` as any);
  }

  return (
    <ScreenContainer scrollable padded>
      <View style={{ paddingTop: insets.top + spacing.sm, marginBottom: spacing.md }}>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Welcome back</Text>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, fontWeight: '800' }]}>{user?.firstName ?? 'there'}</Text>
      </View>

      {all.length === 0 ? (
        <EmptyState icon="layers" title={emptyPortalText().title} description={emptyPortalText().description} />
      ) : (
        <>
          {options.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginBottom: spacing.md, marginHorizontal: -spacing.lg }}>
              <Chip label="All properties" on={!activeProperty} onPress={() => setProperty(null)} />
              {options.map((o) => <Chip key={o.key} label={o.label} on={activeProperty === o.key} onPress={() => setProperty(o.key)} />)}
            </ScrollView>
          )}

          <SectionHeading title="Active Projects" count={active.length} />
          {active.length === 0 ? (
            <View style={[styles.emptyActive, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[typeScale.bodyMedium, { color: colors.textSecondary }]}>
                No active projects right now.{completed.length > 0 ? ' Your completed projects are below.' : ''}
              </Text>
            </View>
          ) : (
            active.map((i) => <ActiveCard key={i.key} item={i} onPress={() => open(i)} />)
          )}

          {completed.length > 0 && (
            <>
              <SectionHeading title="Completed Projects" count={completed.length} style={{ marginTop: spacing.lg }} />
              <View style={[styles.completedList, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                {shownCompleted.map((i, n) => (
                  <CompletedRow key={i.key} item={i} first={n === 0} onPress={() => open(i)} />
                ))}
              </View>
              {completed.length > COMPLETED_PREVIEW && (
                <Pressable onPress={() => setShowAllCompleted((v) => !v)} accessibilityRole="button" style={styles.viewAll}>
                  <Text style={[typeScale.labelLarge, { color: colors.primary }]}>{showAllCompleted ? 'Show fewer' : `View all ${completed.length}`}</Text>
                </Pressable>
              )}
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.border }]}
    >
      <Text style={[typeScale.labelLarge, { color: on ? '#FFFFFF' : colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function SectionHeading({ title, count, style }: { title: string; count: number; style?: object }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.heading, style]}>
      <Text style={[typeScale.headingSmall, { color: colors.textPrimary, fontWeight: '800' }]} accessibilityRole="header">{title}</Text>
      <View style={[styles.count, { backgroundColor: colors.primarySurface }]}>
        <Text style={[typeScale.caption, { color: colors.primaryDark, fontWeight: '700' }]}>{count}</Text>
      </View>
    </View>
  );
}

function TypePill({ item }: { item: HomeItem }) {
  const { colors } = useTheme();
  const snow = item.kind === 'snow';
  const bg = snow ? semantic.infoLight : colors.primarySurface;
  const fg = snow ? semantic.info : colors.primaryDark;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[typeScale.caption, { color: fg, fontWeight: '700' }]}>{item.typeLabel}</Text>
    </View>
  );
}

function ActiveCard({ item, onPress }: { item: HomeItem; onPress: () => void }) {
  const { colors } = useTheme();
  const held = item.status === 'on_hold';
  const update = item.latestUpdate ? `Last update ${fmtDate(item.latestUpdate.at)}` : undefined;
  const line = item.kind === 'project'
    ? [item.progress != null && !held ? `${item.progress}% complete` : undefined, update].filter(Boolean).join(' · ')
    : item.note;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.typeLabel}: ${item.name}. ${item.address}. ${statusLabel(item)}`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }, pressed && { opacity: 0.9 }]}
    >
      <View style={{ flex: 1 }}>
        <TypePill item={item} />
        <Text style={[typeScale.headingSmall, { color: colors.textPrimary, marginTop: spacing.xs }]} numberOfLines={1}>{item.name}</Text>
        {item.address ? (
          <View style={styles.addrRow}>
            <Icon name="map-pin" size={13} color={colors.textTertiary} />
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>{item.address}</Text>
          </View>
        ) : null}
        <Text style={[typeScale.labelLarge, { color: held ? semantic.warning : semantic.success, marginTop: spacing.sm }]}>{statusLabel(item)}</Text>
        {line ? <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 1 }]} numberOfLines={2}>{line}</Text> : null}
        {item.latestUpdate && item.kind === 'project' ? (
          <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 1 }]} numberOfLines={1}>{item.latestUpdate.title}</Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

function CompletedRow({ item, first, onPress }: { item: HomeItem; first: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Completed project: ${item.name}. ${item.address}. Open`}
      style={({ pressed }) => [styles.doneRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { opacity: 0.85 }]}
    >
      <Icon name="check-circle" size={18} color={semantic.success} />
      <View style={{ flex: 1 }}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
          {[item.address, item.completedAt ? `Completed ${fmtDate(item.completedAt)}` : 'Completed'].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={[typeScale.labelLarge, { color: colors.primary }]}>Open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 220 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  count: { minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  dot: { width: 6, height: 6, borderRadius: 3 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  emptyActive: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
  completedList: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, minHeight: 56 },
  viewAll: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
});
