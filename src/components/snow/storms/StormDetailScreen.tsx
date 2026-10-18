/**
 * One storm (Owner): where its work stands, its routes, and the lifecycle
 * actions: Dispatch (draft), End Storm (active, always confirmed), Reopen
 * (ended). The database decides what's allowed; this screen shows its answer.
 *
 * Routes are added here (blank or from a saved template) and edited on the
 * route screen (update 025). Working layout in the existing app style; no
 * approved mockup yet.
 */
import { crewTag } from '@/lib/snowCrew';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, InlineNotice, LoadingSpinner, ProgressBar, ScreenHeader, StatusBadge } from '@/components/ui';
import { confirmAction, showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  deleteDraftStorm, dispatchStorm, endStorm, endStormConfirmation, loadEligibleProperties, loadStormRoutes,
  previewEndStorm, reopenStorm, setStormServices, SERVICE_LABEL, STORM_STATUS_LABEL,
  type StormRouteRow, type StormSummary,
} from '@/data/snowStorms';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { SNOW_SERVICES, type SnowService, type SnowStorm } from '@/types/snow';
import { LOCKED_SERVICE_HELP, lockedServiceNote, removableServices, routeServiceChoice, routesPerService, serviceRouteCount, servicesLabel, stormServices, toggleService } from '@/lib/snowServices';
import { STATUS_TONE } from './StormsListScreen';
import { addRouteFromTemplate, createRoute, loadRouteTemplates, type RouteTemplate } from '@/data/snowRoutes';

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export function StormDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [storm, setStorm] = useState<SnowStorm | null>(null);
  const [summary, setSummary] = useState<StormSummary | null>(null);
  const [routes, setRoutes] = useState<StormRouteRow[]>([]);
  const [eligible, setEligible] = useState<number | null>(null);
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);
  const [choosingService, setChoosingService] = useState(false);
  const [editingServices, setEditingServices] = useState<SnowService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!id) return;
    const ticket = ++latest.current;
    const [s, r] = await Promise.all([previewEndStorm(id), loadStormRoutes(id)]);
    if (ticket !== latest.current) return;
    setLoading(false);
    if (!s.ok) return setError(s.error);
    setError(r.ok ? null : r.error);
    setStorm(s.data.storm);
    setSummary(s.data.summary);
    if (r.ok) setRoutes(r.data);
    if (s.data.storm.status !== 'ended') {
      const t = await loadRouteTemplates(stormServices(s.data.storm));
      if (ticket === latest.current && t.ok) setTemplates(t.data);
    }
    if (s.data.storm.status === 'draft') {
      const e = await loadEligibleProperties(id);
      if (ticket === latest.current && e.ok) setEligible(e.data.length);
    }
  }, [id]);

  useEffect(() => {
    reload();
    if (!id || !isSupabaseConfigured) return;
    const channel = supabase.channel(`snow-storm-${id}`);
    for (const table of ['snow_storms', 'snow_routes', 'snow_visits', 'snow_skip_requests']) {
      const filter = table === 'snow_storms' ? `id=eq.${id}` : `storm_id=eq.${id}`;
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => { reload(); });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, reload]);

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  async function run(action: () => ReturnType<typeof endStorm>, failTitle: string) {
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.ok) return showMessage(failTitle, res.error);
    setStorm(res.data.storm);
    setSummary(res.data.summary);
  }

  function onDispatch() {
    if (!storm) return;
    confirmAction(
      `Dispatch ${storm.name}?`,
      'Route leads can start their routes. You can still add stops, reorder and reassign leads after dispatching.',
      'Dispatch',
      () => run(() => dispatchStorm(storm.id), 'Can\'t dispatch yet'),
    );
  }

  async function onEnd() {
    if (!storm) return;
    // Fresh numbers for the confirmation, not whatever was on screen.
    setBusy(true);
    const preview = await previewEndStorm(storm.id);
    setBusy(false);
    if (!preview.ok) return showMessage('Couldn\'t check the storm', preview.error);
    const { title, message } = endStormConfirmation(preview.data.storm, preview.data.summary);
    confirmAction(title, message, 'End storm', () => run(() => endStorm(storm.id), 'Couldn\'t end the storm'), true);
  }

  function onReopen() {
    if (!storm) return;
    confirmAction(
      `Reopen ${storm.name}?`,
      'Earlier work stays recorded as it is. No customer notifications or photos are sent again. Add new stops for extra passes.',
      'Reopen',
      () => run(() => reopenStorm(storm.id), 'Couldn\'t reopen the storm'),
    );
  }

  function onDelete() {
    if (!storm) return;
    confirmAction(`Delete ${storm.name}?`, 'This draft and its planned routes will be removed.', 'Delete', async () => {
      setBusy(true);
      const res = await deleteDraftStorm(storm.id);
      setBusy(false);
      if (!res.ok) return showMessage('Couldn\'t delete the draft', res.error);
      router.back();
    }, true);
  }

  const openRoute = (routeId: string) => router.push({ pathname: '/snow/owner/route/[id]', params: { id: routeId } });

  /** Adds a route. With several services the owner says which one this route does. */
  async function onAddRoute(picked?: SnowService) {
    if (!storm) return;
    const choice = routeServiceChoice(stormServices(storm), picked);
    if (choice.error) return showMessage('Couldn\'t add the route', choice.error);
    if (choice.needsPick) return setChoosingService(true);
    setChoosingService(false);
    const service = choice.service!;
    const several = stormServices(storm).length > 1;
    const sameService = routes.filter((r) => r.service === service).length;
    const name = several ? `${SERVICE_LABEL[service]} route ${sameService + 1}` : `Route ${routes.length + 1}`;
    setBusy(true);
    const res = await createRoute(storm.id, { name, service, mediaRequired: true, minMedia: 1 });
    setBusy(false);
    if (!res.ok) return showMessage('Couldn\'t add the route', res.error);
    openRoute(res.data);
  }

  async function onSaveServices() {
    if (!storm || !editingServices) return;
    setBusy(true);
    const res = await setStormServices(storm.id, editingServices);
    setBusy(false);
    if (!res.ok) return showMessage('Couldn\'t change the services', res.error);
    setEditingServices(null);
    reload();
  }

  async function onUseTemplate(t: RouteTemplate) {
    if (!storm) return;
    setBusy(true);
    const res = await addRouteFromTemplate(storm.id, t.id);
    setBusy(false);
    if (!res.ok) return showMessage('Couldn\'t add the route', res.error);
    openRoute(res.data);
  }

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
        <ScreenHeader title="Storm" />
        <LoadingSpinner />
      </View>
    );
  }
  if (!storm) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
        <ScreenHeader title="Storm" />
        <EmptyState icon="cloud-off" title="Storm not available" description={error ?? 'It may have been deleted.'} />
      </View>
    );
  }

  const s = summary;
  const remaining = s ? s.pending + s.arrived : 0;
  const progress = s && s.visits ? Math.round((s.completed / s.visits) * 100) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title={storm.name} subtitle={servicesLabel(stormServices(storm), (x) => SERVICE_LABEL[x])} right={<StatusBadge label={STORM_STATUS_LABEL[storm.status]} status={STATUS_TONE[storm.status]} />} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}

        {s ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.stats}>
              <Stat label="Completed" value={s.completed} color={colors.textPrimary} sub={colors.textSecondary} />
              <Stat label="Remaining" value={remaining} color={colors.textPrimary} sub={colors.textSecondary} />
              <Stat label="Skipped" value={s.skipped} color={colors.textPrimary} sub={colors.textSecondary} />
              <Stat label="Routes" value={s.routes} color={colors.textPrimary} sub={colors.textSecondary} />
            </View>
            {s.visits > 0 ? <ProgressBar progress={progress} showLabel style={{ marginTop: spacing.md }} /> : null}
            {s.pendingSkipRequests > 0 ? (
              <InlineNotice
                icon="flag"
                tone="warning"
                text={`${s.pendingSkipRequests} skip ${s.pendingSkipRequests === 1 ? 'request needs' : 'requests need'} your decision`}
                style={{ marginTop: spacing.md }}
              />
            ) : null}
          </View>
        ) : null}

        <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Routes</Text>
        {routes.length ? (
          <View style={[styles.group, { backgroundColor: colors.surface }]}>
            {routes.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => openRoute(r.id)}
                accessibilityRole="button"
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typeScale.bodyLarge, { color: r.cancelled ? colors.textTertiary : colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                    {r.name}{r.cancelled ? ' (cancelled)' : ''}
                  </Text>
                  <Text style={[typeScale.caption, { color: r.leadName ? colors.textSecondary : colors.warning }]} numberOfLines={1}>
                    {SERVICE_LABEL[r.service]} · {r.leadName ? `Lead: ${r.leadName}` : 'No lead yet'}{r.crew > 0 ? ` · ${crewTag(r.crew)}` : ''}
                  </Text>
                </View>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                  {r.stops ? `${r.completed} of ${r.stops} done` : 'No stops'}
                </Text>
                <Icon name="chevron-right" size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, alignItems: 'center' }]}>
            <Icon name="map" size={22} color={colors.textTertiary} />
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
              No routes yet. Add routes and stops, give each route a lead, then dispatch.
            </Text>
          </View>
        )}
        {storm.status !== 'ended' ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {choosingService ? (
              <View style={[styles.card, { backgroundColor: colors.surface, gap: spacing.sm }]}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>What does this route do?</Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>A route does one service. Its stops, lead and photos all follow it.</Text>
                {stormServices(storm).map((sv) => (
                  <Button key={sv} title={SERVICE_LABEL[sv]} variant="secondary" onPress={() => onAddRoute(sv)} disabled={busy} fullWidth />
                ))}
                <Button title="Cancel" variant="ghost" onPress={() => setChoosingService(false)} fullWidth />
              </View>
            ) : (
              <Button title="Add route" icon="plus" variant="secondary" onPress={() => onAddRoute()} disabled={busy} fullWidth />
            )}
            {templates.map((t) => (
              <Button
                key={t.id}
                title={`Add "${t.name}"${stormServices(storm).length > 1 ? ` · ${SERVICE_LABEL[t.service]}` : ''} (${t.stops} ${t.stops === 1 ? 'stop' : 'stops'})`}
                icon="copy"
                variant="ghost"
                onPress={() => onUseTemplate(t)}
                disabled={busy}
                fullWidth
              />
            ))}
          </View>
        ) : null}
        {storm.status === 'draft' && eligible !== null ? (
          <Text style={[typeScale.caption, styles.help, { color: colors.textTertiary }]}>
            {eligible === 0
              ? `No active properties offer ${servicesLabel(stormServices(storm), (x) => SERVICE_LABEL[x].toLowerCase())} yet. Turn the service on for a property first.`
              : `${eligible} ${eligible === 1 ? 'property offers' : 'properties offer'} ${servicesLabel(stormServices(storm), (x) => SERVICE_LABEL[x].toLowerCase())}.`}
          </Text>
        ) : null}

        {storm.status !== 'ended' ? (
          <>
            <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Services</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, gap: spacing.sm }]}>
              {editingServices ? (
                <>
                  {SNOW_SERVICES.map((sv) => {
                    const on = editingServices.includes(sv);
                    const locked = on && !removableServices(stormServices(storm), [...new Set(routes.map((r) => r.service))]).includes(sv) && stormServices(storm).includes(sv);
                    return (
                      <Pressable
                        key={sv}
                        onPress={() => !locked && setEditingServices(toggleService(editingServices, sv))}
                        style={styles.serviceRow}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on, disabled: locked }}
                      >
                        <Icon name={on ? 'check-square' : 'square'} size={20} color={on ? colors.primary : colors.textTertiary} />
                        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{SERVICE_LABEL[sv]}</Text>
                        {locked ? <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{lockedServiceNote(serviceRouteCount(sv, routes))}</Text> : null}
                      </Pressable>
                    );
                  })}
                  {SNOW_SERVICES.some((sv) => editingServices.includes(sv) && routes.some((r) => r.service === sv)) ? (
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{LOCKED_SERVICE_HELP}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button title="Save services" size="sm" icon="check" onPress={onSaveServices} loading={busy} disabled={editingServices.length === 0} />
                    <Button title="Cancel" size="sm" variant="ghost" onPress={() => setEditingServices(null)} />
                  </View>
                </>
              ) : (
                <>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>
                    {servicesLabel(stormServices(storm), (x) => SERVICE_LABEL[x])}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                    {(() => {
                      const per = routesPerService(stormServices(storm), routes.filter((r) => !r.cancelled));
                      return stormServices(storm).map((sv) => `${SERVICE_LABEL[sv]}: ${per[sv]} ${per[sv] === 1 ? 'route' : 'routes'}`).join(' · ');
                    })()}
                  </Text>
                  <Button title="Change services" size="sm" variant="secondary" icon="sliders" onPress={() => setEditingServices(stormServices(storm))} />
                </>
              )}
            </View>
          </>
        ) : null}

        <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>History</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, gap: spacing.xs }]}>
          <HistoryLine text={`Created ${fmt(storm.createdAt)}`} color={colors.textSecondary} />
          {storm.dispatchedAt ? <HistoryLine text={`Dispatched ${fmt(storm.dispatchedAt)}`} color={colors.textSecondary} /> : null}
          {storm.endedAt ? <HistoryLine text={`${storm.status === 'ended' ? 'Ended' : 'Last ended'} ${fmt(storm.endedAt)}`} color={colors.textSecondary} /> : null}
          {storm.reopenedCount > 0 ? (
            <HistoryLine
              text={`Reopened ${storm.reopenedCount === 1 ? 'once' : `${storm.reopenedCount} times`}, last ${fmt(storm.lastReopenedAt)}`}
              color={colors.textSecondary}
            />
          ) : null}
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {storm.status === 'draft' ? (
            <>
              <Button title="Dispatch storm" icon="send" onPress={onDispatch} loading={busy} fullWidth />
              <Button title="Delete draft" variant="ghost" onPress={onDelete} disabled={busy} fullWidth />
            </>
          ) : null}
          {storm.status === 'dispatched' ? (
            <Button title="End storm" icon="flag" variant="danger" onPress={onEnd} loading={busy} fullWidth />
          ) : null}
          {storm.status === 'ended' ? (
            <Button title="Reopen storm" icon="rotate-ccw" variant="secondary" onPress={onReopen} loading={busy} fullWidth />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[typeScale.headingLarge, { color }]}>{value}</Text>
      <Text style={[typeScale.caption, { color: sub }]}>{label}</Text>
    </View>
  );
}

function HistoryLine({ text, color }: { text: string; color: string }) {
  return <Text style={[typeScale.bodySmall, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  label: { marginLeft: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.xl },
  help: { marginTop: spacing.sm, marginHorizontal: spacing.sm },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 56 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40 },
});
