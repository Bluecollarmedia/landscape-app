/**
 * One route on a storm (Owner): name, lead, photo rule, and its stops in
 * order. Stops that haven't been started can be moved up/down or removed;
 * the order is saved in one database call (update 025). Working layout in
 * the existing app style; no approved mockup yet.
 */
import { crewChoices, crewCountLabel, nextCrew } from '@/lib/snowCrew';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, InlineNotice, Input, LoadingSpinner, PressableScale, ScreenHeader, StatusBadge, Switch } from '@/components/ui';
import { confirmAction, showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { loadEligibleProperties, SERVICE_LABEL, type EligibleProperty } from '@/data/snowStorms';
import {
  addStops, cancelRoute, loadLeadLoad, loadRoute, loadRouteCrew, loadSnowLeads, orderWithNext, removeStop, reorderStops, saveRouteAsTemplate, setRouteCrew, stopNeedsPhotos, updateRoute, updateStop,
  type RouteCrewMember, type RouteStop,
  STOP_STATUS_LABEL, type RouteDetail, type SnowLead,
} from '@/data/snowRoutes';
import { OwnerSkipRequests } from './SkipRequests';
import { typeScale } from '@/theme/typography';
import { ReorderableList } from '@/components/ui/ReorderableList';
import { spacing, radius } from '@/theme/spacing';

export const STOP_TONE = { pending: 'neutral', arrived: 'info', completed: 'success', skipped: 'warning' } as const;

export function RouteEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RouteEditor routeId={id} />;
}

/**
 * The route's settings and stops. On its own screen it has a header and a Done button; `embedded` (inside the storm screen) shows
 * just the content: the storm is the route, so there is no route name, template or cancel here.
 */
export function RouteEditor({ routeId: id, embedded = false, onDragActive }: { routeId?: string; embedded?: boolean; onDragActive?: (active: boolean) => void }) {
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
  const [doNext, setDoNext] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [leadLoad, setLeadLoad] = useState<Record<string, string[]>>({});
  const [crew, setCrew] = useState<RouteCrewMember[]>([]);
  const [pickCrew, setPickCrew] = useState(false);
  // The property whose notes and photo setting are being edited.
  const [detailStop, setDetailStop] = useState<RouteStop | null>(null);
  const [stopNote, setStopNote] = useState('');
  const [stopPhotos, setStopPhotos] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');

  const reload = useCallback(async () => {
    if (!id) return;
    const r = await loadRoute(id);
    setLoading(false);
    if (!r.ok) return setError(r.error);
    setError(null);
    setRoute(r.data);
    setName(r.data.name);
    const [l, e, load] = await Promise.all([
      loadSnowLeads(r.data.service), loadEligibleProperties(r.data.stormId, r.data.service), loadLeadLoad(r.data.id),
    ]);
    const c = await loadRouteCrew(r.data.id);
    if (c.ok) setCrew(c.data);
    if (l.ok) setLeads(l.data);
    if (e.ok) setEligible(e.data);
    if (load.ok) setLeadLoad(load.data);
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

  /** Saves a new stop order (from a drag): shows it right away, then lets the database have the final word. */
  async function applyOrder(ids: string[]) {
    if (!route) return;
    setRoute({ ...route, stops: ids.map((sid) => route.stops.find((s) => s.id === sid)!) });
    const res = await reorderStops(route.id, ids);
    if (!res.ok) showMessage("Couldn't reorder", res.error);
    reload();
  }

  /** Adds or removes one crew member. The database gets the whole new list, so a double tap changes nothing. */
  async function changeCrew(personId: string, add: boolean) {
    if (!route) return;
    setBusy(true);
    const res = await setRouteCrew(route.id, nextCrew(crew.map((c) => c.personId), personId, add));
    setBusy(false);
    if (!res.ok) return showMessage("Couldn't change the crew", res.error);
    setPickCrew(false);
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

  /** Puts a stop that hasn't started right after the stops already worked or in progress. */
  async function moveToNext(index: number) {
    if (!route) return;
    const ids = route.stops.map((s) => s.id);
    let lastWorked = -1;
    route.stops.forEach((s, i) => { if (s.status !== 'pending') lastWorked = i; });
    const [id] = ids.splice(index, 1);
    ids.splice(lastWorked + 1, 0, id);
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
    if (res.ok && doNext) {
      const re = await reorderStops(route.id, orderWithNext(route.stops, res.data));
      if (!re.ok) showMessage('Added, but couldn\'t put them next', re.error);
    }
    setBusy(false);
    if (!res.ok) showMessage('Couldn\'t add every stop', res.error);
    setChosen([]);
    setDoNext(false);
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

  /** Everything on this screen saves as it changes; Done also saves a name still being typed, then closes. */
  async function done() {
    if (route && name.trim() && name.trim() !== route.name) {
      setBusy(true);
      const res = await updateRoute(route.id, { name });
      setBusy(false);
      if (!res.ok) return showMessage("Couldn't save", res.error);
    }
    router.back();
  }

  function onCancelRoute() {
    if (!route) return;
    confirmAction(`Cancel ${route.name}?`, 'Its lead stops seeing it. Work already done stays recorded.', 'Cancel route', async () => {
      const res = await cancelRoute(route.id);
      if (!res.ok) return showMessage('Couldn\'t cancel the route', res.error);
      router.back();
    }, true);
  }

  function openStop(stop: RouteStop) {
    setDetailStop(stop);
    setStopNote(stop.ownerNote ?? '');
    setStopPhotos(route ? stopNeedsPhotos(stop, route) : false);
  }

  async function saveStop() {
    if (!detailStop || !route) return;
    setBusy(true);
    const patch: Parameters<typeof updateStop>[1] = {};
    if (stopNote.trim() !== (detailStop.ownerNote ?? '')) patch.ownerNote = stopNote;
    if (stopPhotos !== stopNeedsPhotos(detailStop, route)) patch.photosRequired = stopPhotos;
    const res = Object.keys(patch).length ? await updateStop(detailStop.id, patch) : { ok: true as const };
    setBusy(false);
    if (!res.ok) return showMessage("Couldn't save", res.error);
    setDetailStop(null);
    reload();
  }

  if (loading) {
    if (embedded) return <LoadingSpinner />;
    return (
      <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
        <ScreenHeader title="Route" />
        <LoadingSpinner />
      </View>
    );
  }
  if (!route) {
    if (embedded) return <InlineNotice icon="alert-circle" tone="error" text={error ?? 'This route is not available.'} />;
    return (
      <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
        <ScreenHeader title="Route" />
        <EmptyState icon="map" title="Route not available" description={error ?? 'It may have been removed.'} />
      </View>
    );
  }

  const editable = !route.cancelled && route.stormStatus !== 'ended';
  const leadName = leads.find((l) => l.personId === route.leadPersonId)?.name;
  // A property can be on a route more than once (repeat passes), so every
  // eligible property stays pickable; we just show how many visits it has.
  const visitsOn = new Map<string, number>();
  route.stops.forEach((s) => visitsOn.set(s.propertyId, (visitsOn.get(s.propertyId) ?? 0) + 1));
  const addable = eligible;
  const firstPending = route.stops.findIndex((s) => s.status === 'pending');
  const sep = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight };

  const openCount = route.stops.filter((x) => x.status === 'pending' || x.status === 'arrived').length;

  const body = (
    <>
        {embedded ? (
          <Pressable onPress={() => { setRenameText(route.name); setRenaming(true); }} style={[styles.inline, { marginBottom: spacing.sm }]} accessibilityRole="button" accessibilityLabel="Rename route">
            <Text style={[typeScale.bodyMedium, { color: colors.textSecondary }]} numberOfLines={1}>{route.name}</Text>
            <Icon name="edit-2" size={13} color={colors.textTertiary} />
          </Pressable>
        ) : null}

        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}
        {!route.cancelled && !embedded ? (
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Changes save as you make them. Tap Done when you are finished.
          </Text>
        ) : null}
        {route.cancelled ? <InlineNotice icon="slash" tone="warning" text="This route was cancelled." style={{ marginBottom: spacing.md }} /> : null}

        {route.stormStatus === 'dispatched' ? (
          <View style={{ marginBottom: spacing.md }}>
            <OwnerSkipRequests routeId={route.id} stops={route.stops} leadName={leadName} onDecided={reload} />
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, gap: spacing.md }]}>
          <Pressable onPress={() => editable && setPickLead(!pickLead)} style={styles.inline} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Crew lead</Text>
              <Text style={[typeScale.bodyLarge, { color: leadName ? colors.textPrimary : colors.warning }]}>{leadName ?? 'Assign a crew lead'}</Text>
              {route.leadPersonId && leadLoad[route.leadPersonId] ? (
                <Text style={[typeScale.caption, { color: colors.warning }]}>
                  Also leads {leadLoad[route.leadPersonId].join(', ')}. That's allowed; check the timing.
                </Text>
              ) : null}
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
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{l.name}</Text>
                      {leadLoad[l.personId] ? (
                        <Text style={[typeScale.caption, { color: colors.warning }]}>Already leads {leadLoad[l.personId].join(', ')}</Text>
                      ) : null}
                    </View>
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
          <View>
            <View style={styles.inline}>
              <View style={{ flex: 1 }}>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Crew · optional</Text>
                <Text style={[typeScale.bodyLarge, { color: crew.length ? colors.textPrimary : colors.textTertiary }]}>{crewCountLabel(crew.length)}</Text>
              </View>
              {editable ? <Button title={pickCrew ? 'Close' : 'Add Crew'} size="sm" variant="secondary" icon={pickCrew ? 'x' : 'plus'} disabled={busy} onPress={() => setPickCrew(!pickCrew)} /> : null}
            </View>
            {crew.map((c) => (
              <View key={c.personId} style={[styles.inline, { paddingVertical: spacing.xs }]}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{c.name}</Text>
                {editable ? <Button title="Remove" size="sm" variant="ghost" disabled={busy} onPress={() => changeCrew(c.personId, false)} /> : null}
              </View>
            ))}
            {pickCrew ? (
              crewChoices(leads, route.leadPersonId, crew.map((c) => c.personId)).length ? (
                <View style={[styles.group, { borderColor: colors.borderLight, marginTop: spacing.sm }]}>
                  {crewChoices(leads, route.leadPersonId, crew.map((c) => c.personId)).map((l, i) => (
                    <Pressable key={l.personId} style={[styles.row, i > 0 && sep]} onPress={() => changeCrew(l.personId, true)} accessibilityRole="button">
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{l.name}</Text>
                      <Icon name="plus" size={18} color={colors.primary} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                  No one else on the snow team does {SERVICE_LABEL[route.service].toLowerCase()}.
                </Text>
              )
            ) : null}
          </View>
        </View>

        <View style={[styles.inline, styles.label]}>
          <Text style={[typeScale.overline, { color: colors.textSecondary, flex: 1 }]}>Properties</Text>
          {route.stops.length ? (
            <>
              <StatusBadge label={`Open ${openCount}`} status="info" />
              <StatusBadge label={`Closed ${route.stops.length - openCount}`} status="success" />
            </>
          ) : null}
        </View>
        {route.stops.length ? (
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: 'transparent' }]}>
            <ReorderableList
              items={route.stops}
              keyOf={(s) => s.id}
              rowHeight={STOP_ROW_HEIGHT}
              canDrag={(s) => editable && s.status === 'pending'}
              onReorder={applyOrder}
              onDragActive={(a) => { setDragging(a); onDragActive?.(a); }}
              renderRow={(s, i, handle) => {
                const movable = editable && s.status === 'pending';
                return (
                  <View style={[styles.row, { flex: 1 }, i > 0 && sep]}>
                    {handle ?? <View style={{ width: 32 }} />}
                    <Text style={[typeScale.labelLarge, { color: colors.textTertiary, width: 18 }]}>{i + 1}</Text>
                    <Pressable
                      style={{ flex: 1, gap: 2 }}
                      onPress={() => openStop(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.propertyName}: photos and notes`}
                    >
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>{s.propertyName}</Text>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{s.propertyAddress}</Text>
                      <View style={styles.inline}>
                        <Icon name="camera" size={12} color={stopNeedsPhotos(s, route) ? colors.primary : colors.textTertiary} />
                        <Text style={[typeScale.caption, { color: stopNeedsPhotos(s, route) ? colors.primary : colors.textTertiary }]}>{stopNeedsPhotos(s, route) ? 'Photos required' : 'No photos required'}</Text>
                        {s.ownerNote ? <><Icon name="file-text" size={12} color={colors.primary} /><Text style={[typeScale.caption, { color: colors.primary }]} numberOfLines={1}>Note</Text></> : null}
                      </View>
                    </Pressable>
                    {movable ? (
                      <View style={styles.inline}>
                        <IconTap icon="chevrons-up" label="Move to next" disabled={i === firstPending} onPress={() => moveToNext(i)} color={colors.textSecondary} />
                        <IconTap icon="arrow-up" label="Move up" disabled={i === 0} onPress={() => move(i, -1)} color={colors.textSecondary} />
                        <IconTap icon="arrow-down" label="Move down" disabled={i === route.stops.length - 1} onPress={() => move(i, 1)} color={colors.textSecondary} />
                        <IconTap icon="x" label="Remove stop" onPress={() => onRemove(s.id, s.propertyName)} color={colors.error} />
                      </View>
                    ) : (
                      <StatusBadge label={STOP_STATUS_LABEL[s.status]} status={STOP_TONE[s.status]} />
                    )}
                  </View>
                );
              }}
            />
          </View>
        ) : (
          <Text style={[typeScale.bodySmall, styles.help, { color: colors.textSecondary }]}>No properties yet. Tap Add Property below.</Text>
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
                      {visitsOn.get(p.propertyId) ? (
                        <Text style={[typeScale.caption, { color: colors.primary }]}>
                          Already on this route ×{visitsOn.get(p.propertyId)}. Adding it again makes another visit.
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }) : (
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                  No property offers {SERVICE_LABEL[route.service].toLowerCase()} yet.
                </Text>
              )}
              {route.stormStatus === 'dispatched' && route.stops.length > 0 ? (
                <View style={[styles.inline, { marginTop: spacing.md }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>Do these next</Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                      Puts them right after the stop the lead is on, ahead of stops not yet started.
                    </Text>
                  </View>
                  <Switch value={doNext} onValueChange={setDoNext} accessibilityLabel="Do these next" />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <Button title="Cancel" variant="ghost" onPress={() => { setPickStops(false); setChosen([]); }} />
                <Button title={chosen.length ? `Add ${chosen.length}` : 'Add'} disabled={!chosen.length} loading={busy} onPress={onAddStops} />
              </View>
            </View>
          ) : (
            <Button title="Add Property" icon="plus" variant={embedded ? 'primary' : 'secondary'} onPress={() => setPickStops(true)} style={{ marginTop: spacing.md }} fullWidth size={embedded ? 'lg' : undefined} />
          )
        ) : null}

        {!embedded ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {route.stops.length ? (
            <Button title="Save as template" icon="copy" variant="secondary" onPress={onSaveTemplate} disabled={busy} fullWidth />
          ) : null}
          {editable ? <Button title="Cancel route" variant="ghost" onPress={onCancelRoute} disabled={busy} fullWidth /> : null}
        </View>
        ) : null}

        {embedded && route.stops.length ? (
          <Text style={[typeScale.caption, styles.help, { color: colors.textTertiary, marginTop: spacing.xs }]}>Tap a property to set photos and add a note for it.</Text>
        ) : null}

        <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <Input label="Route name" value={renameText} onChangeText={setRenameText} autoFocus />
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                <Button title="Cancel" variant="ghost" onPress={() => setRenaming(false)} />
                <Button title="Save" icon="check" disabled={!renameText.trim()} onPress={() => { setRenaming(false); if (renameText.trim() && renameText.trim() !== route.name) save({ name: renameText }); }} />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={!!detailStop} transparent animationType="fade" onRequestClose={() => setDetailStop(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>{detailStop?.propertyName}</Text>
              {detailStop?.propertyAddress ? <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{detailStop.propertyAddress}</Text> : null}
              <View style={[styles.inline, { marginTop: spacing.lg }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>Photos required here</Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>The crew must add a photo before finishing this property.</Text>
                </View>
                <Switch value={stopPhotos} disabled={!editable || busy || detailStop?.status === 'completed' || detailStop?.status === 'skipped'} onValueChange={setStopPhotos} accessibilityLabel="Photos required at this property" />
              </View>
              <Input label="Notes for this property" value={stopNote} onChangeText={setStopNote} editable={editable} multiline numberOfLines={4} placeholder="Gate code, where to pile snow, what to watch for" containerStyle={{ marginTop: spacing.lg }} />
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                <Button title="Cancel" variant="ghost" onPress={() => setDetailStop(null)} />
                {editable ? <Button title="Save" icon="check" loading={busy} onPress={saveStop} /> : null}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
    </>
  );

  if (embedded) return <View>{body}</View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader
        title={route.name}
        subtitle={`${route.stormName} · ${SERVICE_LABEL[route.service]}`}
        right={
          <View style={styles.inline}>
            <IconTap icon="edit-2" label="Rename route" onPress={() => { setRenameText(route.name); setRenaming(true); }} color={colors.textSecondary} />
          <PressableScale
            onPress={done}
            disabled={busy}
            scaleTo={0.92}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={[styles.done, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={[typeScale.labelLarge, { color: colors.textOnPrimary }]}>Done</Text>
          </PressableScale>
          </View>
        }
      />
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
        keyboardShouldPersistTaps="handled"
      >
      {body}
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

/** Every stop row is this tall so a dragged row can slide between its neighbours. */
const STOP_ROW_HEIGHT = 72;

const styles = StyleSheet.create({
  done: { height: 44, paddingHorizontal: spacing.lg, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1 },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  label: { marginLeft: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.xl },
  help: { marginHorizontal: spacing.sm },
  group: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: radius.xl, padding: spacing.xl },
});
