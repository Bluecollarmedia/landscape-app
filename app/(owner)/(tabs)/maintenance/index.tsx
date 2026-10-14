import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import {
  Button, EmptyState, FadeInItem, IconTile, PressableScale, ProgressBar, RaisedAddButton, StatusBadge,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useMaintenanceHome, type MaintenanceDueItem, type MaintenanceRouteSummary } from '@/hooks/useMaintenanceHome';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';

/** How many due/overdue rows the home shows before "See all". */
const DUE_PREVIEW = 5;

const ROUTES = {
  newRoute: '/(owner)/route-new',
  properties: '/(owner)/maintenance/properties',
  property: (id: string) => `/(owner)/maintenance/properties/${id}`,
  routes: '/(owner)/maintenance/routes',
  route: (id: string) => `/(owner)/maintenance/routes/${id}`,
};

function formatShortDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dueLabel(days: number): { label: string; status: 'error' | 'warning' | 'neutral' } {
  if (days > 0) return { label: `Overdue by ${days} day${days === 1 ? '' : 's'}`, status: 'error' };
  if (days === 0) return { label: 'Due today', status: 'warning' };
  const ahead = -days;
  return { label: `Due in ${ahead} day${ahead === 1 ? '' : 's'}`, status: 'neutral' };
}

export default function MaintenanceHomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const home = useMaintenanceHome();
  const [refreshing, setRefreshing] = useState(false);

  const { refresh } = home;
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const go = (route: string) => router.push(route as any);

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const overdueCount = home.dueItems.filter((d) => d.daysOverdue > 0).length;
  const dueTodayCount = home.dueItems.filter((d) => d.daysOverdue === 0).length;
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let body: React.ReactNode;
  if (!home.ready) {
    body = <ActivityIndicator style={{ marginTop: spacing['3xl'] }} color={colors.primary} />;
  } else if (home.loadError && home.activePropertyCount === 0 && home.todayRoutes.length === 0) {
    body = (
      <EmptyState
        icon="alert-circle"
        title="Couldn't load Maintenance"
        description="Check your connection and try again."
        actionTitle={refreshing ? 'Trying…' : 'Try Again'}
        onAction={pullToRefresh}
      />
    );
  } else {
    body = (
      <>
        <FadeInItem index={0}>
          <TodaySection routes={home.todayRoutes} onOpen={(id) => go(ROUTES.route(id))} onCreate={() => go(ROUTES.newRoute)} />
        </FadeInItem>

        <FadeInItem index={1} style={styles.entryRow}>
          <EntryTile
            icon="home"
            title="Properties"
            subtitle={home.activePropertyCount === 1 ? '1 active contract' : `${home.activePropertyCount} active contracts`}
            onPress={() => go(ROUTES.properties)}
          />
          <EntryTile
            icon="calendar"
            title="Daily Routes"
            subtitle="Past and upcoming"
            onPress={() => go(ROUTES.routes)}
          />
        </FadeInItem>

        <FadeInItem index={2}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>Needs service</Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                {home.dueItems.length === 0
                  ? 'Nothing due right now'
                  : [
                      overdueCount > 0 ? `${overdueCount} overdue` : null,
                      dueTodayCount > 0 ? `${dueTodayCount} due today` : null,
                      home.dueItems.length - overdueCount - dueTodayCount > 0
                        ? `${home.dueItems.length - overdueCount - dueTodayCount} coming up`
                        : null,
                    ].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {home.dueItems.length > DUE_PREVIEW && (
              <PressableScale onPress={() => go(ROUTES.properties)} accessibilityRole="button" accessibilityLabel="See all properties">
                <Text style={[typeScale.labelLarge, { color: colors.primaryDark }]}>See all</Text>
              </PressableScale>
            )}
          </View>

          {home.activePropertyCount === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <EmptyState
                icon="home"
                title="No maintenance properties yet"
                description="Add each property and its contract once, then build a route each day from what's due."
                actionTitle="Add Properties"
                onAction={() => go(ROUTES.properties)}
              />
            </View>
          ) : home.dueItems.length === 0 ? (
            <View style={[styles.card, styles.allClear, { backgroundColor: colors.surface }]}>
              <Icon name="check-circle" size={20} color={semantic.success} />
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
                Every active contract is up to date.
              </Text>
            </View>
          ) : (
            <View style={[styles.card, styles.listCard, { backgroundColor: colors.surface }]}>
              {home.dueItems.slice(0, DUE_PREVIEW).map((item, i) => (
                <DueRow
                  key={item.key}
                  item={item}
                  first={i === 0}
                  onPress={() => go(ROUTES.property(item.propertyId))}
                />
              ))}
            </View>
          )}
        </FadeInItem>
      </>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarClearance + spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeIn.duration(260)} style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Maintenance</Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{todayLabel}</Text>
          </View>
          <RaisedAddButton onPress={() => go(ROUTES.newRoute)} accessibilityLabel="Create a new route" />
        </Animated.View>
        {body}
      </ScrollView>
    </View>
  );
}

function TodaySection({
  routes, onOpen, onCreate,
}: { routes: MaintenanceRouteSummary[]; onOpen: (id: string) => void; onCreate: () => void }) {
  const { colors } = useTheme();

  if (routes.length === 0) {
    return (
      <View style={[styles.card, styles.todayEmpty, { backgroundColor: colors.surface }]}>
        <IconTile name="map" size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>No route for today</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            Pick from what's due and assign the crew.
          </Text>
        </View>
        <Button title="New Route" size="sm" onPress={onCreate} />
      </View>
    );
  }

  return (
    <View>
      <Text style={[typeScale.overline, styles.overline, { color: colors.textSecondary }]}>TODAY'S ROUTE{routes.length > 1 ? 'S' : ''}</Text>
      {routes.map((r) => {
        const pct = r.stopCount === 0 ? 0 : Math.round((r.completedCount / r.stopCount) * 100);
        const done = r.stopCount > 0 && r.completedCount >= r.stopCount;
        return (
          <PressableScale
            key={r.id}
            onPress={() => onOpen(r.id)}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${r.name || "Today's route"}, ${r.completedCount} of ${r.stopCount} stops done`}
            style={[styles.card, styles.routeCard, { backgroundColor: colors.surface }]}
          >
            <View style={styles.routeTop}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                {r.name || "Today's route"}
              </Text>
              <StatusBadge label={done ? 'Done' : r.completedCount > 0 ? 'In progress' : 'Not started'} status={done ? 'success' : r.completedCount > 0 ? 'info' : 'neutral'} />
            </View>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
              {r.completedCount} of {r.stopCount} stop{r.stopCount === 1 ? '' : 's'} done
            </Text>
            <ProgressBar progress={pct} style={{ marginTop: spacing.sm }} />
            <View style={styles.crewRow}>
              <Icon name="users" size={14} color={colors.textTertiary} />
              <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                {r.crewNames.length === 0 ? 'No crew assigned' : r.crewNames.join(', ')}
              </Text>
              {r.crewNames.length > 0 && (
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                  {r.checkedInCount} of {r.crewNames.length} checked in
                </Text>
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

function EntryTile({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.card, styles.entryTile, { backgroundColor: colors.surface }]}
    >
      <IconTile name={icon} size={40} />
      <Text style={[typeScale.labelLarge, { color: colors.textPrimary, marginTop: spacing.sm }]} numberOfLines={1}>{title}</Text>
      <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
    </PressableScale>
  );
}

function DueRow({ item, first, onPress }: { item: MaintenanceDueItem; first: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const due = dueLabel(item.daysOverdue);
  const hasSeason = item.seasonalTotal != null && item.seasonalTotal > 0;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${item.propertyName}, ${item.serviceName}, ${due.label}`}
      style={[styles.dueRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
          {item.propertyName}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.serviceName} · Last {formatShortDate(item.lastServiceDate)}
          {hasSeason ? ` · ${item.seasonalCompleted ?? 0} of ${item.seasonalTotal} done` : ''}
        </Text>
      </View>
      <StatusBadge label={due.label} status={due.status} />
    </PressableScale>
  );
}

const cardShadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: '#1B3A2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
})!;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg + spacing.xs,
    marginBottom: spacing.lg,
  },
  overline: { paddingHorizontal: spacing.lg + spacing.lg, marginBottom: spacing.sm },
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg + 2,
    ...cardShadow,
  },
  todayEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  routeCard: { padding: spacing.md + 2, marginBottom: spacing.md },
  routeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginTop: spacing.sm + 2 },
  entryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
  },
  entryTile: { flex: 1, marginHorizontal: 0, padding: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg + spacing.xs,
    marginBottom: spacing.sm,
  },
  listCard: { overflow: 'hidden' },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
});
