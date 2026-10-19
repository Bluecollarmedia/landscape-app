/**
 * One storm (Owner): where its work stands, its routes, and the lifecycle
 * actions: Dispatch (draft), End Storm (active, always confirmed), Reopen
 * (ended). The database decides what's allowed; this screen shows its answer.
 *
 * Routes are added here (blank or from a saved template) and edited on the
 * route screen (update 025). Layout: the approved icy-blue design (winter
 * picture behind the header only, white cards, summary, routes, services and
 * a history timeline). The lifecycle buttons and their wording are unchanged.
 */
import { crewTag } from '@/lib/snowCrew';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ImageBackground } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, GlassIconButton, Icon, InlineNotice, LoadingSpinner, ProgressBar, ScreenHeader } from '@/components/ui';
import { SnowPill } from '@/components/snow/SnowPill';
import { snowStatus } from '@/theme/colors';
import { historyEvents, routeCountLabel } from '@/lib/snowStormView';
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
import { addRouteFromTemplate, createRoute, loadRouteTemplates, type RouteTemplate } from '@/data/snowRoutes';

/** The winter header picture, bundled with the app (made by scripts/make-storm-header.py from assets/source/snow-panorama.jpg). */
const STORM_HEADER_IMAGE = require('../../../../assets/images/snow-storm-header.jpg');

/** Badge colours per storm state, from the Snow palette. */
const STORM_PILL = { draft: snowStatus.scheduled, dispatched: snowStatus.dispatched, ended: snowStatus.completed } as const;

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
  const tone = STORM_PILL[storm.status];
  const servicesText = servicesLabel(stormServices(storm), (x) => SERVICE_LABEL[x]);
  const perService = routesPerService(stormServices(storm), routes.filter((r) => !r.cancelled));
  const history = historyEvents(storm);

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['4xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* The header picture is decorative: it sits behind the title only and never behind the cards. */}
        <ImageBackground
          source={STORM_HEADER_IMAGE}
          resizeMode="cover"
          style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
          accessibilityIgnoresInvertColors
        >
          <View style={styles.headerTop}>
            <GlassIconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
            <SnowPill label={STORM_STATUS_LABEL[storm.status]} fg={tone.fg} bg={tone.bg} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]} accessibilityRole="header">{storm.name}</Text>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: 2 }]}>{servicesText}</Text>
        </ImageBackground>

        <View style={styles.body}>
          {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}

          {s ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.stats}>
                <Stat label="Completed" value={s.completed} color={colors.textPrimary} sub={colors.textSecondary} />
                <Stat label="Remaining" value={remaining} color={colors.textPrimary} sub={colors.textSecondary} divider={colors.border} />
                <Stat label="Skipped" value={s.skipped} color={colors.textPrimary} sub={colors.textSecondary} divider={colors.border} />
                <Stat label={s.routes === 1 ? 'Route' : 'Routes'} value={s.routes} color={colors.textPrimary} sub={colors.textSecondary} divider={colors.border} />
              </View>
              <View style={styles.progressRow}>
                <ProgressBar progress={progress} height={6} style={{ flex: 1 }} />
                <Text style={[typeScale.labelSmall, { color: colors.textSecondary }]}>{progress}% complete</Text>
              </View>
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

          <Text style={[typeScale.headingSmall, styles.sectionTitle, { color: colors.textPrimary }]}>Routes</Text>
          {routes.length ? (
            <View style={{ gap: spacing.sm }}>
              {routes.map((r) => {
                const pct = r.stops ? Math.round((r.completed / r.stops) * 100) : 0;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => openRoute(r.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${r.name}. ${r.leadName ? `Crew lead ${r.leadName}` : 'No crew lead yet'}. ${r.stops ? `${r.completed} of ${r.stops} stops` : 'No stops'}`}
                    style={({ pressed }) => [styles.routeCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.75 }]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: colors.primarySurface }]}>
                      <Icon name="cloud-snow" size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.routeTop}>
                        <Text style={[typeScale.headingSmall, { color: r.cancelled ? colors.textTertiary : colors.textPrimary, flex: 1 }]}>
                          {r.name}{r.cancelled ? ' (cancelled)' : ''}
                        </Text>
                        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{r.stops ? `${r.completed} of ${r.stops} stops` : 'No stops'}</Text>
                        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                      </View>
                      <Text style={[typeScale.bodyMedium, { color: colors.textSecondary }]}>{SERVICE_LABEL[r.service]}</Text>
                      <View style={styles.leadRow}>
                        <Icon name="user" size={14} color={r.leadName ? colors.textSecondary : colors.warning} />
                        <Text style={[typeScale.bodyMedium, { color: r.leadName ? colors.textSecondary : colors.warning, flex: 1 }]}>
                          {r.leadName ? `Crew lead: ${r.leadName}` : 'No crew lead yet'}{r.crew > 0 ? ` · ${crewTag(r.crew)}` : ''}
                        </Text>
                      </View>
                      <ProgressBar progress={pct} height={5} style={{ marginTop: spacing.xs }} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
              <Icon name="map" size={22} color={colors.textTertiary} />
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
                No properties yet. Add properties and stops, give each one a lead, then dispatch. Each becomes a route when you dispatch.
              </Text>
            </View>
          )}

          {storm.status !== 'ended' ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {choosingService ? (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.sm }]}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>What does this route do?</Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>A route does one service. Its stops, lead and photos all follow it.</Text>
                  {stormServices(storm).map((sv) => (
                    <Button key={sv} title={SERVICE_LABEL[sv]} variant="secondary" onPress={() => onAddRoute(sv)} disabled={busy} fullWidth />
                  ))}
                  <Button title="Cancel" variant="ghost" onPress={() => setChoosingService(false)} fullWidth />
                </View>
              ) : (
                <Button title="Add Property" icon="plus" onPress={() => onAddRoute()} disabled={busy} fullWidth size="lg" />
              )}
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => onUseTemplate(t)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Add saved route ${t.name}, ${t.stops} ${t.stops === 1 ? 'stop' : 'stops'}`}
                  style={({ pressed }) => [styles.savedRoute, { backgroundColor: colors.primarySurface, borderColor: colors.border }, (pressed || busy) && { opacity: 0.6 }]}
                >
                  <Icon name="copy" size={18} color={colors.primary} />
                  <Text style={[typeScale.labelLarge, { color: colors.primary, flexShrink: 1 }]}>
                    {`Add saved route: ${t.name}${stormServices(storm).length > 1 ? ` · ${SERVICE_LABEL[t.service]}` : ''} (${t.stops} ${t.stops === 1 ? 'stop' : 'stops'})`}
                  </Text>
                </Pressable>
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
              <Text style={[typeScale.headingSmall, styles.sectionTitle, { color: colors.textPrimary }]}>Services</Text>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.sm }]}>
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
                  <View style={styles.servicesRow}>
                    <View style={{ flex: 1, gap: spacing.sm }}>
                      {stormServices(storm).map((sv) => (
                        <View key={sv} style={styles.serviceLine}>
                          <View style={[styles.iconCircle, { backgroundColor: colors.primarySurface }]}>
                            <Icon name="cloud-snow" size={20} color={colors.primary} />
                          </View>
                          <View>
                            <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>{SERVICE_LABEL[sv]}</Text>
                            <Text style={[typeScale.bodyMedium, { color: colors.textSecondary }]}>{routeCountLabel(perService[sv])}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      onPress={() => setEditingServices(stormServices(storm))}
                      accessibilityRole="button"
                      accessibilityLabel="Change services"
                      style={({ pressed }) => [styles.changeServices, { backgroundColor: colors.primarySurface }, pressed && { opacity: 0.6 }]}
                    >
                      <Icon name="sliders" size={16} color={colors.primary} />
                      <Text style={[typeScale.labelLarge, { color: colors.primary }]}>Change Services</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </>
          ) : null}

          <Text style={[typeScale.headingSmall, styles.sectionTitle, { color: colors.textPrimary }]}>History</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {history.map((e, i) => (
              <View key={e.key} style={styles.historyRow}>
                <View style={styles.timeline}>
                  <View style={[styles.marker, { backgroundColor: colors.primary }]} />
                  {i < history.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
                </View>
                <Text style={[typeScale.bodyLarge, { flex: 1, paddingBottom: i < history.length - 1 ? spacing.md : 0 }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{e.label}</Text>
                  <Text style={{ color: colors.textSecondary }}>{`  ${e.when}`}</Text>
                </Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {storm.status === 'draft' ? (
              <>
                <Button title="Dispatch storm" icon="send" onPress={onDispatch} loading={busy} fullWidth size="lg" />
                <Button title="Delete draft" variant="ghost" onPress={onDelete} disabled={busy} fullWidth />
              </>
            ) : null}
            {storm.status === 'dispatched' ? (
              <Button title="End storm" icon="flag" variant="danger" onPress={onEnd} loading={busy} fullWidth size="lg" />
            ) : null}
            {storm.status === 'ended' ? (
              <Button title="Reopen storm" icon="rotate-ccw" variant="secondary" onPress={onReopen} loading={busy} fullWidth size="lg" />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color, sub, divider }: { label: string; value: number; color: string; sub: string; divider?: string }) {
  return (
    <View style={[styles.stat, divider ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: divider } : null]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[typeScale.bodySmall, { color: sub }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 210, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.4 },
  body: { paddingHorizontal: spacing.lg, marginTop: -spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth },
  stats: { flexDirection: 'row' },
  stat: { alignItems: 'center', flex: 1, paddingVertical: spacing.xs },
  statValue: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  routeCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  routeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  help: { marginTop: spacing.sm, marginHorizontal: spacing.sm },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40 },
  servicesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  serviceLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  changeServices: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.full },
  historyRow: { flexDirection: 'row', gap: spacing.md },
  timeline: { width: 12, alignItems: 'center', paddingTop: 6 },
  marker: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, flex: 1, marginTop: 2 },
});
