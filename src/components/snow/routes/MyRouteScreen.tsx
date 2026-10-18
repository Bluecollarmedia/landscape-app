/**
 * Snow worker "My Route": the route this person leads on a dispatched storm.
 * Shows the current stop with directions, I'm Here, completion photos and
 * Finish Stop, then the whole route in order. The database decides what's
 * allowed (order, one stop at a time, photo minimum, dispatched storm only;
 * update 026). Working layout in the existing app style; no approved mockup.
 */
import { pickActiveRoute, splitMyRoutes } from '@/lib/snowMyRoute';
import { canWorkRoute } from '@/lib/snowCrew';
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
  type MyRoute, type RouteDetail,
} from '@/data/snowRoutes';
import { STOP_TONE } from './RouteEditScreen';
import { LeadSkipPanel } from './SkipRequests';
import { SnowServiceReferenceCard } from '@/components/snow/SnowReference';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

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

  const current = route?.stops.find((s) => s.status === 'arrived') ?? route?.stops.find((s) => s.status === 'pending');
  const done = route?.stops.filter((s) => s.status === 'completed' || s.status === 'skipped').length ?? 0;
  const working = route?.stormStatus === 'dispatched' && !route.cancelled;
  const { active: activeRoutes, history: pastRoutes } = splitMyRoutes(routes);
  // Update 41: crew can see the route, its stops and instructions; only the lead can act on it.
  const isLead = canWorkRoute(routes.find((r) => r.id === route?.id)?.role);
  const needMedia = route && current && route.mediaRequired ? Math.max(0, route.minMedia - current.mediaCount) : 0;

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
              {route.name} · {route.stormName} · {SERVICE_LABEL[route.service]} · {done} of {route.stops.length} done
            </Text>
            {!working ? (
              <InlineNotice icon="info" tone="info" text={route.cancelled ? 'This route was cancelled.' : 'This storm has ended. Nothing more to do here.'} style={{ marginTop: spacing.md }} />
            ) : null}

            {working && current ? (
              <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.md, gap: spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[typeScale.overline, { color: colors.textSecondary, flex: 1 }]}>
                    {current.status === 'arrived' ? 'You\'re here' : 'Next stop'}
                  </Text>
                  <StatusBadge label={STOP_STATUS_LABEL[current.status]} status={STOP_TONE[current.status]} />
                </View>
                <View>
                  <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>{current.propertyName}</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{current.propertyAddress}</Text>
                </View>
                <Button title="Directions" icon="navigation" variant="secondary" onPress={() => openDirections({ address: current.propertyAddress })} fullWidth />
                {!isLead ? (
                  <InlineNotice icon="eye" tone="info" text="You're on this route's crew. The route lead marks arrivals, finishes stops and adds photos." />
                ) : current.status === 'pending' ? (
                  <Button title="I'm Here" icon="map-pin" loading={busy} onPress={() => act(() => arriveAtStop(current.id), 'Can\'t start this stop')} fullWidth />
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
                      onPress={async () => { if (await act(() => finishStop(current.id, note), 'Can\'t finish yet')) setNote(''); }}
                      fullWidth
                    />
                  </>
                )}
                {isLead ? <LeadSkipPanel visitId={current.id} disabled={busy} onChanged={reload} /> : null}
              </View>
            ) : null}
            {working && current ? (
              <>
                <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>
                  {SERVICE_LABEL[route.service]} instructions
                </Text>
                <SnowServiceReferenceCard propertyId={current.propertyId} service={route.service} />
              </>
            ) : null}
            {working && !current && route.stops.length ? (
              <InlineNotice icon="check-circle" tone="success" text="Every stop on this route is done." style={{ marginTop: spacing.md }} />
            ) : null}

            <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>All stops</Text>
            <View style={[styles.group, { backgroundColor: colors.surface }]}>
              {route.stops.map((s, i) => (
                <View key={s.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}>
                  <Text style={[typeScale.labelLarge, { color: colors.textTertiary, width: 22 }]}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]} numberOfLines={1}>{s.propertyName}</Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{s.propertyAddress}</Text>
                  </View>
                  {s.status === 'completed' ? <Icon name="check-circle" size={18} color={colors.success} /> : (
                    <StatusBadge label={STOP_STATUS_LABEL[s.status]} status={STOP_TONE[s.status]} />
                  )}
                </View>
              ))}
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
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{r.stormName} · {SERVICE_LABEL[r.service]} · Ended</Text>
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
