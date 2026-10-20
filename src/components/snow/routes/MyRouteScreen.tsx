/**
 * Snow worker "My Route": the route this person leads on a dispatched storm.
 * Shows the current stop with directions, I'm Here, completion photos and
 * Finish Stop, then the whole route in order. The database decides what's
 * allowed (order, one stop at a time, photo minimum, dispatched storm only;
 * update 026). Working layout in the existing app style; no approved mockup.
 */
import { pickActiveRoute, splitMyRoutes } from '@/lib/snowMyRoute';
import { canWorkRoute } from '@/lib/snowCrew';
import { groupStatus, groupStops, isGroupClosed, servicesText } from '@/lib/snowStopGroups';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, InlineNotice, Input, LoadingSpinner, StatusBadge } from '@/components/ui';
import { showMessage } from '@/components/financials/ActionSheet';
import { pickSnowMedia } from '@/components/snow/pickSnowMedia';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { openDirections } from '@/lib/maps';
import { SERVICE_LABEL } from '@/data/snowStorms';
import {
  addCompletionMedia, arriveAtStop, finishStop, loadMyRoutes, loadRoute, STOP_STATUS_LABEL,
  type MyRoute, type RouteDetail, type RouteStop,
  stopNeedsPhotos,
} from '@/data/snowRoutes';
import { STOP_TONE } from './RouteEditScreen';
import { LeadSkipPanel } from './SkipRequests';
import { SnowServiceReferenceCard } from '@/components/snow/SnowReference';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { SnowService } from '@/types/snow';

export function MyRouteScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const [routes, setRoutes] = useState<MyRoute[]>([]);
  const [routeId, setRouteId] = useState<string | null>(null);
  // A past route the worker opened from History (read-only). Never chosen automatically.
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const reload = useCallback(async () => {
    const mine = await loadMyRoutes();
    if (!mine.ok) { setLoading(false); return setError(mine.error); }
    setRoutes(mine.data);
    // Current work is only ever a route on a dispatched storm. A past route is shown
    // only when the worker opens it from History.
    const { active } = splitMyRoutes(mine.data);
    const current = pickActiveRoute(active, routeId);
    setRouteId(current);
    const pick = historyId && mine.data.some((r) => r.id === historyId) ? historyId : current;
    if (!pick) { setRoute(null); setLoading(false); return setError(null); }
    const r = await loadRoute(pick);
    setLoading(false);
    setError(r.ok ? null : r.error);
    if (r.ok) setRoute(r.data);
  }, [routeId, historyId]);

  useEffect(() => { reload(); }, [reload]);

  async function act(run: () => Promise<{ ok: boolean; error?: string }>, failTitle: string) {
    setBusy(true);
    const res = await run();
    setBusy(false);
    if (!res.ok) showMessage(failTitle, res.error ?? '');
    await reload();
    return res.ok;
  }

  if (loading) {
    return <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}><LoadingSpinner /></View>;
  }

  // A route that does several services together has one visit per service at each property. The crew works the property
  // once, so those visits are one stop here: I'm Here starts all of them, Finish Stop finishes all of them.
  const groups = route ? groupStops(route.stops) : [];
  const currentGroup = groups.find((g) => !isGroupClosed(g));
  const current = currentGroup?.[0];
  const done = groups.filter(isGroupClosed).length;
  const working = route?.stormStatus === 'dispatched' && !route.cancelled;
  const { active: activeRoutes, history: pastRoutes } = splitMyRoutes(routes);
  // Update 41: crew can see the route, its stops and instructions; only the lead can act on it.
  const isLead = canWorkRoute(routes.find((r) => r.id === route?.id)?.role);
  const svcLabel = (x: string) => SERVICE_LABEL[x as SnowService];
  const groupServices = (g: RouteStop[]) => g.map((v) => v.service ?? route!.service);
  // Photos are added once for the stop, on its first visit.
  const needMedia = route && current && stopNeedsPhotos(current, route) ? Math.max(0, route.minMedia - current.mediaCount) : 0;

  /** Starts every visit at this property that has not been started, in order. Stops at the first problem. */
  async function arriveGroup(g: RouteStop[]): Promise<{ ok: boolean; error?: string }> {
    for (const v of g.filter((x) => x.status === 'pending')) {
      const res = await arriveAtStop(v.id);
      if (!res.ok) return res;
    }
    return { ok: true };
  }

  /** Finishes every visit at this property that is not finished. The note goes on the first one. */
  async function finishGroup(g: RouteStop[]): Promise<{ ok: boolean; error?: string }> {
    let first = true;
    for (const v of g.filter((x) => x.status === 'arrived' || x.status === 'pending')) {
      const res = await finishStop(v.id, first ? note : undefined);
      if (!res.ok) return res;
      first = false;
    }
    return { ok: true };
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance + spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>My Route</Text>
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginTop: spacing.md }} /> : null}

        {historyId ? (
          <Pressable onPress={() => setHistoryId(null)} style={styles.backToCurrent} accessibilityRole="button" accessibilityLabel="Back to current work">
            <Icon name="arrow-left" size={18} color={colors.primary} />
            <Text style={[typeScale.labelLarge, { color: colors.primary }]}>Back to current work</Text>
          </Pressable>
        ) : null}

        {!historyId && activeRoutes.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
            {activeRoutes.map((r) => {
              const on = r.id === routeId;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setRouteId(r.id)}
                  style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surface }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[typeScale.labelLarge, { color: on ? colors.textOnPrimary : colors.textPrimary }]}>{r.name}</Text>
                  <Text style={[typeScale.caption, { color: on ? colors.textOnPrimary : colors.textSecondary }]}>{r.stormName}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {!route ? (
          <EmptyState icon="navigation" title="No active route" description="When the owner dispatches a storm and makes you a route lead, your stops show up here. Finished storms are under Past work below." />
        ) : (
          <>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {route.name} · {route.stormName} · {servicesText(route.services, svcLabel)} · {done} of {groups.length} done
            </Text>
            {!working ? (
              <InlineNotice icon="info" tone="info" text={route.cancelled ? 'This route was cancelled.' : 'This storm has ended. Nothing more to do here.'} style={{ marginTop: spacing.md }} />
            ) : null}

            {working && current && currentGroup ? (
              <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.md, gap: spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[typeScale.overline, { color: colors.textSecondary, flex: 1 }]}>
                    {groupStatus(currentGroup) === 'pending' ? 'Next stop' : 'You\'re here'}
                  </Text>
                  <StatusBadge label={STOP_STATUS_LABEL[groupStatus(currentGroup)]} status={STOP_TONE[groupStatus(currentGroup)]} />
                </View>
                <View>
                  <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>{current.propertyName}</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{current.propertyAddress}</Text>
                  {route.services.length > 1 ? (
                    <Text style={[typeScale.labelLarge, { color: colors.primary, marginTop: 2 }]}>{servicesText(groupServices(currentGroup), svcLabel)}</Text>
                  ) : null}
                </View>
                {current.ownerNote ? (
                  <InlineNotice icon="file-text" tone="info" text={current.ownerNote} />
                ) : null}
                <Button title="Directions" icon="navigation" variant="secondary" onPress={() => openDirections({ address: current.propertyAddress })} fullWidth />
                {!isLead ? (
                  <InlineNotice icon="eye" tone="info" text="You're on this route's crew. The route lead marks arrivals, finishes stops and adds photos." />
                ) : groupStatus(currentGroup) === 'pending' ? (
                  <Button title="I'm Here" icon="map-pin" loading={busy} onPress={() => act(() => arriveGroup(currentGroup), 'Can\'t start this stop')} fullWidth />
                ) : (
                  <>
                    <Button
                      title={current.mediaCount ? `Add photos (${current.mediaCount} added)` : 'Add photos'}
                      icon="camera"
                      variant="secondary"
                      disabled={busy}
                      onPress={async () => {
                        const drafts = await pickSnowMedia();
                        if (drafts.length) act(() => addCompletionMedia(route.companyId, current.id, drafts), 'Couldn\'t add the photos');
                      }}
                      fullWidth
                    />
                    <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="Anything the owner should know" />
                    {needMedia > 0 ? (
                      <Text style={[typeScale.caption, { color: colors.warning }]}>
                        Add {needMedia} more {needMedia === 1 ? 'photo' : 'photos'} before finishing this stop.
                      </Text>
                    ) : null}
                    <Button
                      title="Finish Stop"
                      icon="check"
                      loading={busy}
                      disabled={needMedia > 0}
                      onPress={async () => { if (await act(() => finishGroup(currentGroup), 'Can\'t finish yet')) setNote(''); }}
                      fullWidth
                    />
                  </>
                )}
                {isLead ? currentGroup.filter((v) => v.status !== 'completed' && v.status !== 'skipped').map((v) => (
                  <View key={v.id} style={{ gap: spacing.xs }}>
                    {currentGroup.length > 1 ? <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{svcLabel(v.service ?? route.service)}</Text> : null}
                    <LeadSkipPanel visitId={v.id} disabled={busy} onChanged={reload} />
                  </View>
                )) : null}
              </View>
            ) : null}
            {working && current && currentGroup ? (
              <>
                {Array.from(new Set(groupServices(currentGroup))).map((sv) => (
                  <View key={sv}>
                    <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>
                      {svcLabel(sv)} instructions
                    </Text>
                    <SnowServiceReferenceCard propertyId={current.propertyId} service={sv} />
                  </View>
                ))}
              </>
            ) : null}
            {working && !current && groups.length ? (
              <InlineNotice icon="check-circle" tone="success" text="Every stop on this route is done." style={{ marginTop: spacing.md }} />
            ) : null}

            <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>All stops</Text>
            <View style={[styles.group, { backgroundColor: colors.surface }]}>
              {groups.map((g, i) => {
                const s = g[0];
                const status = groupStatus(g);
                return (
                <View key={s.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}>
                  <Text style={[typeScale.labelLarge, { color: colors.textTertiary, width: 22 }]}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]} numberOfLines={1}>{s.propertyName}</Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{s.propertyAddress}</Text>
                    {route.services.length > 1 ? <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{servicesText(groupServices(g), svcLabel)}</Text> : null}
                    {s.ownerNote ? <Text style={[typeScale.caption, { color: colors.primary }]} numberOfLines={2}>{s.ownerNote}</Text> : null}
                  </View>
                  {status === 'completed' ? <Icon name="check-circle" size={18} color={colors.success} /> : (
                    <StatusBadge label={STOP_STATUS_LABEL[status]} status={STOP_TONE[status]} />
                  )}
                </View>
                );
              })}
            </View>
          </>
        )}

        {!historyId && pastRoutes.length > 0 ? (
          <>
            <Pressable onPress={() => setShowHistory(!showHistory)} style={styles.historyHeader} accessibilityRole="button" accessibilityState={{ expanded: showHistory }}>
              <Text style={[typeScale.overline, { color: colors.textSecondary, flex: 1 }]}>PAST WORK ({pastRoutes.length})</Text>
              <Icon name={showHistory ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </Pressable>
            {showHistory ? (
              <View style={[styles.group, { backgroundColor: colors.surface }]}>
                {pastRoutes.map((r, i) => (
                  <Pressable
                    key={r.id}
                    onPress={() => { setHistoryId(r.id); setLoading(true); }}
                    style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
                    accessibilityRole="button"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]} numberOfLines={1}>{r.name}</Text>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{r.stormName} · {servicesText(r.services ?? [r.service], svcLabel)} · Ended</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  backToCurrent: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  historyHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.sm },
  chip: { borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  label: { marginLeft: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.xl },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
});
