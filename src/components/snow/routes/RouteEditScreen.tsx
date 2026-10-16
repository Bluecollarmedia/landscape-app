/**
 * One route on a storm (Owner): name, lead, photo rule, and its stops in
 * order. Stops that haven't been started can be moved up/down or removed;
 * the order is saved in one database call (update 025). Working layout in
 * the existing app style; no approved mockup yet.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, InlineNotice, Input, LoadingSpinner, ScreenHeader, StatusBadge, Switch } from '@/components/ui';
import { confirmAction, showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { loadEligibleProperties, SERVICE_LABEL, type EligibleProperty } from '@/data/snowStorms';
import {
  addStops, cancelRoute, loadRoute, loadSnowLeads, removeStop, reorderStops, saveRouteAsTemplate, updateRoute,
  STOP_STATUS_LABEL, type RouteDetail, type SnowLead,
} from '@/data/snowRoutes';
import { OwnerSkipRequests } from './SkipRequests';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

export const STOP_TONE = { pending: 'neutral', arrived: 'info', completed: 'success', skipped: 'warning' } as const;

export function RouteEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [leads, setLeads] = useState<SnowLead[]>([]);
  const [eligible, setEligible] = useState<EligibleProperty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [pickLead, setPickLead] = useState(false);
  const [pickStops, setPickStops] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!id) return;
    const r = await loadRoute(id);
    setLoading(false);
    if (!r.ok) return setError(r.error);
    setError(null);
    setRoute(r.data);
    setName(r.data.name);
    const [l, e] = await Promise.all([loadSnowLeads(r.data.service), loadEligibleProperties(r.data.stormId)]);
    if (l.ok) setLeads(l.data);
    if (e.ok) setEligible(e.data);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  async function save(patch: Parameters<typeof updateRoute>[1]) {
    if (!route) return;
    setBusy(true);
    const res = await updateRoute(route.id, patch);
    setBusy(false);
    if (!res.ok) return showMessage('Couldn\'t save', res.error);
    reload();
  }

  async function move(index: number, delta: -1 | 1) {
    if (!route) return;
    const ids = route.stops.map((s) => s.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    // Show the new order right away; the database has the final word.
    setRoute({ ...route, stops: ids.map((sid) => route.stops.find((s) => s.id === sid)!) });
    const res = await reorderStops(route.id, ids);
    if (!res.ok) showMessage('Couldn\'t reorder', res.error);
    reload();
  }

  function onRemove(stopId: string, label: string) {
    confirmAction(`Remove ${label}?`, 'This stop hasn\'t been started, so nothing is lost.', 'Remove', async () => {
      const res = await removeStop(stopId);
      if (!res.ok) showMessage('Couldn\'t remove the stop', res.error);
      reload();
    }, true);
  }

  async function onAddStops() {
    if (!route || !chosen.length) return;
    setBusy(true);
    const res = await addStops(route.id, chosen);
    setBusy(false);
    if (!res.ok) showMessage('Couldn\'t add every stop', res.error);
    setChosen([]);
    setPickStops(false);
    reload();
  }

  async function onSaveTemplate() {
    if (!route) return;
    setBusy(true);
    const res = await saveRouteAsTemplate(route.id, route.name);
    setBusy(false);
    showMessage(res.ok ? 'Template saved' : 'Couldn\'t save the template',
      res.ok ? `"${route.name}" can be added to the next ${SERVICE_LABEL[route.service].toLowerCase()} storm.` : res.error);
  }

  function onCancelRoute() {
    if (!route) return;
    confirmAction(`Cancel ${route.name}?`, 'Its lead stops seeing it. Work already done stays recorded.', 'Cancel route', async () => {
      const res = await cancelRoute(route.id);
      if (!res.ok) return showMessage('Couldn\'t cancel the route', res.error);
      router.back();
    }, true);
  }

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
        <ScreenHeader title="Route" />
        <LoadingSpinner />
      </View>
    );
  }
  if (!route) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
        <ScreenHeader title="Route" />
        <EmptyState icon="map" title="Route not available" description={error ?? 'It may have been removed.'} />
      </View>
    );
  }

  const editable = !route.cancelled && route.stormStatus !== 'ended';
  const leadName = leads.find((l) => l.personId === route.leadPersonId)?.name;
  const onRoute = new Set(route.stops.map((s) => s.propertyId));
  const addable = eligible.filter((p) => !onRoute.has(p.propertyId));
  const sep = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight };

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title={route.name} subtitle={`${route.stormName} · ${SERVICE_LABEL[route.service]}`} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}
        {route.cancelled ? <InlineNotice icon="slash" tone="warning" text="This route was cancelled." style={{ marginBottom: spacing.md }} /> : null}

        {route.stormStatus === 'dispatched' ? (
          <View style={{ marginBottom: spacing.md }}>
            <OwnerSkipRequests routeId={route.id} stops={route.stops} leadName={leadName} onDecided={reload} />
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, gap: spacing.md }]}>
          <Input
            label="Route name"
            value={name}
            onChangeText={setName}
            editable={editable}
            onEndEditing={() => { if (name.trim() && name.trim() !== route.name) save({ name }); }}
          />
          <Pressable onPress={() => editable && setPickLead(!pickLead)} style={styles.inline} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Lead</Text>
              <Text style={[typeScale.bodyLarge, { color: leadName ? colors.textPrimary : colors.warning }]}>{leadName ?? 'Pick a lead'}</Text>
            </View>
            {editable ? <Icon name={pickLead ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} /> : null}
          </Pressable>
          {pickLead ? (
            leads.length ? (
              <View style={[styles.group, { borderColor: colors.borderLight }]}>
                {leads.map((l, i) => (
                  <Pressable
                    key={l.personId}
                    style={[styles.row, i > 0 && sep]}
                    onPress={() => { setPickLead(false); save({ leadPersonId: l.personId }); }}
                  >
                    <Text style={[typeScale.bodyLarge, { flex: 1, color: colors.textPrimary }]}>{l.name}</Text>
                    {l.personId === route.leadPersonId ? <Icon name="check" size={18} color={colors.primary} /> : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                Nobody on the snow team does {SERVICE_LABEL[route.service].toLowerCase()} yet.
              </Text>
            )
          ) : null}
          <View style={styles.inline}>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>Photos required</Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                {route.mediaRequired ? `At least ${route.minMedia} per stop before Finish Stop` : 'Optional at each stop'}
              </Text>
            </View>
            <Switch value={route.mediaRequired} disabled={!editable || busy} onValueChange={(v) => save({ mediaRequired: v })} accessibilityLabel="Photos required" />
          </View>
          {route.mediaRequired && editable ? (
            <View style={styles.inline}>
              <Text style={[typeScale.bodySmall, { flex: 1, color: colors.textSecondary }]}>Photos per stop</Text>
              <Button title="−" size="sm" variant="secondary" disabled={busy || route.minMedia <= 1} onPress={() => save({ minMedia: route.minMedia - 1 })} />
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, minWidth: 28, textAlign: 'center' }]}>{route.minMedia}</Text>
              <Button title="+" size="sm" variant="secondary" disabled={busy || route.minMedia >= 20} onPress={() => save({ minMedia: route.minMedia + 1 })} />
            </View>
          ) : null}
        </View>

        <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Stops</Text>
        {route.stops.length ? (
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: 'transparent' }]}>
            {route.stops.map((s, i) => {
              const movable = editable && s.status === 'pending';
              return (
                <View key={s.id} style={[styles.row, i > 0 && sep]}>
                  <Text style={[typeScale.labelLarge, { color: colors.textTertiary, width: 22 }]}>{i + 1}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>{s.propertyName}</Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{s.propertyAddress}</Text>
                  </View>
                  {movable ? (
                    <View style={styles.inline}>
                      <IconTap icon="arrow-up" label="Move up" disabled={i === 0} onPress={() => move(i, -1)} color={colors.textSecondary} />
                      <IconTap icon="arrow-down" label="Move down" disabled={i === route.stops.length - 1} onPress={() => move(i, 1)} color={colors.textSecondary} />
                      <IconTap icon="x" label="Remove stop" onPress={() => onRemove(s.id, s.propertyName)} color={colors.error} />
                    </View>
                  ) : (
                    <StatusBadge label={STOP_STATUS_LABEL[s.status]} status={STOP_TONE[s.status]} />
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[typeScale.bodySmall, styles.help, { color: colors.textSecondary }]}>No stops yet.</Text>
        )}

        {editable ? (
          pickStops ? (
            <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.md }]}>
              {addable.length ? addable.map((p, i) => {
                const on = chosen.includes(p.propertyId);
                return (
                  <Pressable
                    key={p.propertyId}
                    style={[styles.row, { paddingHorizontal: 0 }, i > 0 && sep]}
                    onPress={() => setChosen(on ? chosen.filter((x) => x !== p.propertyId) : [...chosen, p.propertyId])}
                  >
                    <Icon name={on ? 'check-square' : 'square'} size={20} color={on ? colors.primary : colors.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{p.name}</Text>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{p.address}</Text>
                    </View>
                  </Pressable>
                );
              }) : (
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                  Every property that offers {SERVICE_LABEL[route.service].toLowerCase()} is already on this route.
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <Button title="Cancel" variant="ghost" onPress={() => { setPickStops(false); setChosen([]); }} />
                <Button title={chosen.length ? `Add ${chosen.length}` : 'Add'} disabled={!chosen.length} loading={busy} onPress={onAddStops} />
              </View>
            </View>
          ) : (
            <Button title="Add stops" icon="plus" variant="secondary" onPress={() => setPickStops(true)} style={{ marginTop: spacing.md }} fullWidth />
          )
        ) : null}

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {route.stops.length ? (
            <Button title="Save as template" icon="copy" variant="secondary" onPress={onSaveTemplate} disabled={busy} fullWidth />
          ) : null}
          {editable ? <Button title="Cancel route" variant="ghost" onPress={onCancelRoute} disabled={busy} fullWidth /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function IconTap({ icon, label, onPress, disabled, color }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void; disabled?: boolean; color: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={{ padding: 6, opacity: disabled ? 0.3 : 1 }}>
      <Icon name={icon} size={18} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  label: { marginLeft: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.xl },
  help: { marginHorizontal: spacing.sm },
  group: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
