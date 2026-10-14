import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform, ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Input, Avatar, CrewLabel, InlineNotice, Switch } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import {
  useRouteBuilder, personById,
  type RouteCandidate, type StopDraft, type DueState, type CandidateService,
} from '@/hooks/useRouteBuilder';
import { offsetDateKey, todayKey } from '@/lib/ids';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { haptics } from '@/lib/haptics';

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') alert(msg);
  else Alert.alert(title, msg);
}

function confirmAction(title: string, msg: string, okLabel: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (confirm(msg)) run();
  } else {
    Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: okLabel, onPress: run }]);
  }
}

function formatDay(key: string, style: 'chip' | 'full' | 'short') {
  const d = new Date(key + 'T12:00:00');
  if (style === 'chip') return d.toLocaleDateString('en-US', { weekday: 'short' });
  if (style === 'short') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** The owner picks two weeks ahead; routes are made the day of or the day before. */
const DATE_CHOICES = Array.from({ length: 14 }, (_, i) => offsetDateKey(i));

function serviceLine(s: CandidateService): string {
  const parts: string[] = [s.name];
  if (s.state === 'overdue' && s.daysOverdue) parts.push(`Overdue by ${s.daysOverdue} day${s.daysOverdue === 1 ? '' : 's'}`);
  else if (s.state === 'due') parts.push('Due');
  else if (s.state === 'upcoming' && s.dueDate) parts.push(`Next ${formatDay(s.dueDate, 'short')}`);
  else if (s.state === 'unknown') parts.push('Schedule not set');
  return parts.join(' · ');
}

function serviceDetail(s: CandidateService): string | undefined {
  const parts: string[] = [];
  parts.push(s.lastServiceDate ? `Last ${formatDay(s.lastServiceDate, 'short')}` : 'No service yet');
  if (s.seasonTarget) {
    const done = s.completedCount ?? 0;
    parts.push(`${done} of ${s.seasonTarget} done, ${Math.max(0, s.seasonTarget - done)} left`);
  }
  return parts.join(' · ');
}

const emptyStop = (c: RouteCandidate): StopDraft => ({
  propertyId: c.propertyId,
  // Due and overdue services are the reason for the visit; the owner can add others.
  serviceIds: c.services.filter(s => s.state === 'overdue' || s.state === 'due').map(s => s.serviceId),
  instructions: '',
  checklist: [],
  photoRequired: false,
});

/**
 * New maintenance route: date, which properties (most urgent first), their
 * order, per-stop instructions, the maintenance crew and an optional lead.
 * Saving creates fresh route and stop records. Nothing is marked done and no
 * contract counts change until a stop is actually finished.
 */
export default function NewRouteScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();

  const [serviceDate, setServiceDate] = useState(params.date ?? todayKey());
  const { candidates, maintenanceCrew, createRoute } = useRouteBuilder(serviceDate);

  const [stops, setStops] = useState<StopDraft[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [crewAssigned, setCrewAssigned] = useState(false);
  const [leadPersonId, setLeadPersonId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [step, setStep] = useState<'build' | 'review'>('build');
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState<Record<string, string>>({});

  const byId = useMemo(() => Object.fromEntries(candidates.map(c => [c.propertyId, c])), [candidates]);
  const needsAttention = candidates.filter(c => c.urgency === 'overdue' || c.urgency === 'due');
  const overdueCount = candidates.filter(c => c.urgency === 'overdue').length;
  const listed = showAll ? candidates : needsAttention;
  const selectedIds = new Set(stops.map(s => s.propertyId));
  const crewMembers = maintenanceCrew.members;

  function toggleProperty(c: RouteCandidate) {
    haptics.select();
    setStops(prev => prev.some(s => s.propertyId === c.propertyId)
      ? prev.filter(s => s.propertyId !== c.propertyId)
      // New picks go to the end, so the owner's existing order never shifts.
      : [...prev, emptyStop(c)]);
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= stops.length) return;
    haptics.select();
    setStops(prev => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function patchStop(propertyId: string, patch: Partial<StopDraft>) {
    setStops(prev => prev.map(s => s.propertyId === propertyId ? { ...s, ...patch } : s));
  }

  function addChecklistItem(stop: StopDraft) {
    const label = (newItem[stop.propertyId] ?? '').trim();
    if (!label) return;
    patchStop(stop.propertyId, { checklist: [...stop.checklist, label] });
    setNewItem(prev => ({ ...prev, [stop.propertyId]: '' }));
  }

  function toggleService(stop: StopDraft, serviceId: string) {
    haptics.select();
    const has = stop.serviceIds.includes(serviceId);
    patchStop(stop.propertyId, { serviceIds: has ? stop.serviceIds.filter(id => id !== serviceId) : [...stop.serviceIds, serviceId] });
  }

  function changeDate(key: string) {
    if (key === serviceDate) return;
    haptics.select();
    setServiceDate(key);
  }

  function assignCrew() {
    if (crewMembers.length === 0) return;
    haptics.success();
    setCrewAssigned(true);
  }

  function unassignCrew() {
    haptics.select();
    setCrewAssigned(false);
    setLeadPersonId(null);
  }

  function goToReview() {
    if (stops.length === 0) return notify('Pick Properties', 'Add at least one property to the route.');
    const noService = stops.filter(s => s.serviceIds.length === 0).map(s => byId[s.propertyId]?.label ?? 'A stop');
    if (noService.length) {
      return notify('Pick a Service', `Choose what to do at ${noService.join(', ')}. Open the stop and tap a service.`);
    }
    setStep('review');
  }

  function save() {
    if (saving) return;
    const run = () => {
      setSaving(true);
      try {
        createRoute({
          serviceDate,
          notes: notes.trim(),
          stops: stops.map(s => ({ ...s, instructions: s.instructions.trim() })),
          crewId: crewAssigned ? maintenanceCrew.crew?.id ?? null : null,
          crewPersonIds: crewAssigned ? crewMembers.map(p => p.id) : [],
          leadPersonId: crewAssigned ? leadPersonId : null,
        });
        haptics.success();
        router.back();
      } catch (e) {
        setSaving(false);
        notify('Couldn\'t Save Route', e instanceof Error ? e.message : 'Try again.');
      }
    };
    if (!crewAssigned) {
      confirmAction('No Crew Assigned', 'Save this route without a crew? Nobody will see it until you assign the maintenance crew.', 'Save Anyway', run);
    } else {
      run();
    }
  }

  const header = (
    <>
      <Pressable
        onPress={() => (step === 'review' ? setStep('build') : router.back())}
        style={[styles.closeButton, { backgroundColor: colors.surface }, shadow.sm]}
        accessibilityRole="button"
        accessibilityLabel={step === 'review' ? 'Back to editing' : 'Close'}
      >
        <Icon name={step === 'review' ? 'chevron-left' : 'x'} size={20} color={colors.textPrimary} />
      </Pressable>
      <Text style={[typeScale.displayLarge, { color: colors.textPrimary, marginTop: spacing.md }]}>
        {step === 'review' ? 'Review Route' : 'New Route'}
      </Text>
      <Text style={[typeScale.bodyLarge, { color: colors.textTertiary, marginTop: 2 }]}>
        {step === 'review'
          ? `${formatDay(serviceDate, 'full')} · ${stops.length} stop${stops.length === 1 ? '' : 's'}`
          : 'Pick the properties for the day, put them in order and assign the crew'}
      </Text>
    </>
  );

  const card = [styles.card, { backgroundColor: colors.surface }, shadow.sm];
  const sectionTitle = [typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' as const, flex: 1 }];

  const lead = leadPersonId ? personById(leadPersonId) : undefined;

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {header}

        {step === 'build' ? (
          <>
            {/* 1. Date */}
            <View style={card}>
              <View style={styles.cardHeader}>
                <Text style={sectionTitle}>Service date</Text>
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{formatDay(serviceDate, 'full')}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                {DATE_CHOICES.map((key, i) => {
                  const on = key === serviceDate;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => changeDate(key)}
                      style={[styles.dateChip, { backgroundColor: on ? colors.primary : colors.backgroundTertiary }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={formatDay(key, 'full')}
                    >
                      <Text style={[typeScale.caption, { color: on ? colors.textOnPrimary : colors.textSecondary }]}>
                        {i === 0 ? 'Today' : i === 1 ? 'Tmrw' : formatDay(key, 'chip')}
                      </Text>
                      <Text style={[typeScale.headingLarge, { color: on ? colors.textOnPrimary : colors.textPrimary }]}>
                        {Number(key.slice(8))}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2. Properties */}
            <View style={card}>
              <View style={styles.cardHeader}>
                <Text style={sectionTitle}>Properties</Text>
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{stops.length} selected</Text>
              </View>
              {candidates.length > 0 && (
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                  {needsAttention.length === 0
                    ? 'Nothing is due right now.'
                    : `${overdueCount} overdue, ${needsAttention.length - overdueCount} due. Most urgent first. Add as many as the crew can handle.`}
                </Text>
              )}
              {candidates.length === 0 && (
                <InlineNotice icon="map-pin" tone="neutral" text="No maintenance properties yet. Add them under Maintenance, Properties." />
              )}
              {listed.map(c => (
                <CandidateRow
                  key={c.propertyId}
                  candidate={c}
                  selected={selectedIds.has(c.propertyId)}
                  onPress={() => toggleProperty(c)}
                />
              ))}
              {candidates.length > needsAttention.length && (
                <Pressable onPress={() => setShowAll(s => !s)} style={styles.linkRow} accessibilityRole="button">
                  <Text style={[typeScale.bodyLarge, { color: colors.primary, fontWeight: '600' }]}>
                    {showAll ? 'Show only due and overdue' : `Show all ${candidates.length} properties`}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* 3 + 4. Order and stop instructions */}
            {stops.length > 0 && (
              <View style={card}>
                <View style={styles.cardHeader}>
                  <Text style={sectionTitle}>Stop order</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Crew goes top to bottom</Text>
                </View>
                {stops.map((stop, i) => {
                  const c = byId[stop.propertyId];
                  const open = expanded === stop.propertyId;
                  const extras = [
                    stop.instructions.trim() ? 'Note' : null,
                    stop.checklist.length ? `${stop.checklist.length} task${stop.checklist.length === 1 ? '' : 's'}` : null,
                    stop.photoRequired ? 'Photos' : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <View key={stop.propertyId} style={[styles.stop, { borderColor: colors.border }]}>
                      <View style={styles.stopHeader}>
                        <View style={[styles.stopNumber, { backgroundColor: colors.primary }]}>
                          <Text style={[typeScale.labelSmall, { color: colors.textOnPrimary }]}>{i + 1}</Text>
                        </View>
                        <Pressable
                          style={{ flex: 1, gap: 2 }}
                          onPress={() => setExpanded(open ? null : stop.propertyId)}
                          accessibilityRole="button"
                          accessibilityLabel={`Stop ${i + 1}, ${c?.label}. ${open ? 'Hide' : 'Show'} details`}
                        >
                          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>{c?.label}</Text>
                          <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>
                            {extras || 'Tap to add notes, tasks or photos'}
                          </Text>
                        </Pressable>
                        <IconButton name="arrow-up" label="Move up" disabled={i === 0} onPress={() => move(i, -1)} />
                        <IconButton name="arrow-down" label="Move down" disabled={i === stops.length - 1} onPress={() => move(i, 1)} />
                      </View>

                      {open && c && (
                        <View style={styles.stopBody}>
                          <Text style={[typeScale.labelSmall, { color: colors.textSecondary }]}>Services this visit</Text>
                          <View style={styles.chipWrap}>
                            {c.services.map(s => {
                              const on = stop.serviceIds.includes(s.serviceId);
                              return (
                                <Pressable
                                  key={s.serviceId}
                                  onPress={() => toggleService(stop, s.serviceId)}
                                  style={[styles.chip, { backgroundColor: on ? colors.primarySurface : colors.backgroundTertiary, borderColor: on ? colors.primary : 'transparent' }]}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: on }}
                                >
                                  <Text style={[typeScale.bodySmall, { color: on ? colors.primaryDark : colors.textSecondary, fontWeight: '600' }]}>{s.name}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          {c.accessNotes ? (
                            <InlineNotice icon="info" tone="neutral" text={`Property notes: ${c.accessNotes}`} />
                          ) : null}
                          <Input
                            label="Instructions for this visit"
                            value={stop.instructions}
                            onChangeText={t => patchStop(stop.propertyId, { instructions: t })}
                            placeholder="e.g. Customer said the strip by the playground was missed last time"
                            multiline
                          />
                          <Text style={[typeScale.labelSmall, { color: colors.textSecondary }]}>Checklist</Text>
                          {stop.checklist.map((item, j) => (
                            <View key={`${item}-${j}`} style={styles.checkItem}>
                              <Icon name="square" size={16} color={colors.textTertiary} />
                              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1 }]}>{item}</Text>
                              <IconButton
                                name="x"
                                label={`Remove ${item}`}
                                onPress={() => patchStop(stop.propertyId, { checklist: stop.checklist.filter((_, k) => k !== j) })}
                              />
                            </View>
                          ))}
                          <View style={styles.addItemRow}>
                            <View style={{ flex: 1 }}>
                              <Input
                                value={newItem[stop.propertyId] ?? ''}
                                onChangeText={t => setNewItem(prev => ({ ...prev, [stop.propertyId]: t }))}
                                placeholder="Add a task"
                                onSubmitEditing={() => addChecklistItem(stop)}
                                returnKeyType="done"
                              />
                            </View>
                            <IconButton name="plus" label="Add task" onPress={() => addChecklistItem(stop)} />
                          </View>
                          <View style={styles.switchRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>Photos required</Text>
                              <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Crew can't finish the stop without them</Text>
                            </View>
                            <Switch
                              value={stop.photoRequired}
                              onValueChange={val => patchStop(stop.propertyId, { photoRequired: val })}
                              accessibilityLabel="Photos required"
                            />
                          </View>
                          <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                            These only apply to this visit. The property's contract stays the same.
                          </Text>
                          <Pressable onPress={() => toggleProperty(c)} style={styles.linkRow} accessibilityRole="button">
                            <Text style={[typeScale.bodySmall, { color: semantic.error, fontWeight: '600' }]}>Remove from route</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
                <Input
                  label="Notes for the whole route"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Fuel up before leaving the yard"
                  multiline
                />
              </View>
            )}

            {/* 5 + 6. Crew and optional lead */}
            <View style={card}>
              <View style={styles.cardHeader}>
                <Text style={sectionTitle}>Crew</Text>
                {crewAssigned && maintenanceCrew.crew && (
                  <CrewLabel name={maintenanceCrew.crew.name} color={maintenanceCrew.crew.color} />
                )}
              </View>
              {crewMembers.length === 0 ? (
                <InlineNotice
                  icon="users"
                  tone="warning"
                  text="No approved maintenance workers yet. Add or approve a maintenance worker, then put them in the maintenance crew."
                />
              ) : !crewAssigned ? (
                <Pressable
                  onPress={assignCrew}
                  style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
                  accessibilityRole="button"
                >
                  <Icon name="users" size={18} color={colors.primary} />
                  <Text style={[typeScale.labelLarge, { color: colors.primary }]}>Assign Maintenance Crew</Text>
                </Pressable>
              ) : (
                <>
                  {crewMembers.map(p => (
                    <View key={p.id} style={styles.workerRow}>
                      <Avatar firstName={p.firstName} lastName={p.lastName} size={32} uri={p.avatarUrl} />
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{p.firstName} {p.lastName}</Text>
                      {leadPersonId === p.id && <LeadBadge />}
                    </View>
                  ))}
                  <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>Maintenance Lead (optional)</Text>
                  <View style={styles.chipWrap}>
                    {[{ id: null as string | null, label: 'No lead' }, ...crewMembers.map(p => ({ id: p.id as string | null, label: p.firstName }))].map(o => {
                      const on = leadPersonId === o.id;
                      return (
                        <Pressable
                          key={o.id ?? 'none'}
                          onPress={() => { haptics.select(); setLeadPersonId(o.id); }}
                          style={[styles.chip, { backgroundColor: on ? colors.primarySurface : colors.backgroundTertiary, borderColor: on ? colors.primary : 'transparent' }]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[typeScale.bodySmall, { color: on ? colors.primaryDark : colors.textSecondary, fontWeight: '600' }]}>{o.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                    The lead coordinates the day. Everyone on the crew can still check in and finish stops.
                  </Text>
                  <Pressable onPress={unassignCrew} style={styles.linkRow} accessibilityRole="button">
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary, fontWeight: '600' }]}>Unassign crew</Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        ) : (
          <>
            <View style={card}>
              <Text style={sectionTitle}>Stops</Text>
              {stops.map((stop, i) => {
                const c = byId[stop.propertyId];
                const services = c?.services.filter(s => stop.serviceIds.includes(s.serviceId)).map(s => s.name).join(', ');
                return (
                  <View key={stop.propertyId} style={styles.reviewStop}>
                    <View style={[styles.stopNumber, { backgroundColor: colors.primary }]}>
                      <Text style={[typeScale.labelSmall, { color: colors.textOnPrimary }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{c?.label}</Text>
                      <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{c?.address}</Text>
                      <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{services}</Text>
                      {stop.instructions.trim() ? (
                        <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>“{stop.instructions.trim()}”</Text>
                      ) : null}
                      {(stop.checklist.length > 0 || stop.photoRequired) && (
                        <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                          {[stop.checklist.length ? `${stop.checklist.length} checklist item${stop.checklist.length === 1 ? '' : 's'}` : null, stop.photoRequired ? 'Photos required' : null].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {notes.trim() ? (
                <InlineNotice icon="clipboard" tone="neutral" text={`Route notes: ${notes.trim()}`} />
              ) : null}
            </View>
            <View style={card}>
              <Text style={sectionTitle}>Crew</Text>
              {crewAssigned ? (
                <>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                    {crewMembers.map(p => p.firstName).join(', ')}
                  </Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                    Lead: {lead ? `${lead.firstName} ${lead.lastName}` : 'None'}
                  </Text>
                </>
              ) : (
                <InlineNotice icon="alert-circle" tone="warning" text="No crew assigned. Nobody will see this route yet." />
              )}
            </View>
            <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.md }]}>
              Saving plans these visits. Services only count as done when the crew finishes each stop.
            </Text>
          </>
        )}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.groupedBackground, borderTopColor: colors.border }]}>
        <Pressable
          onPress={step === 'build' ? goToReview : save}
          disabled={saving}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: pressed || saving ? colors.primaryDark : colors.primary }]}
          accessibilityRole="button"
        >
          <Icon name={step === 'build' ? 'arrow-right' : 'check'} size={18} color={colors.textOnPrimary} />
          <Text style={[typeScale.labelLarge, { color: colors.textOnPrimary, fontSize: 17 }]}>
            {step === 'build'
              ? `Review Route${stops.length ? ` · ${stops.length} stop${stops.length === 1 ? '' : 's'}` : ''}`
              : saving ? 'Saving…' : 'Save Route'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function CandidateRow({ candidate: c, selected, onPress }: { candidate: RouteCandidate; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const tone: Record<DueState, { fg: string; bg: string; label: string }> = {
    overdue: { fg: colors.error, bg: colors.errorLight, label: 'Overdue' },
    due: { fg: colors.warning, bg: colors.warningLight, label: 'Due' },
    upcoming: { fg: colors.textSecondary, bg: colors.backgroundTertiary, label: 'Not due' },
    unknown: { fg: colors.textSecondary, bg: colors.backgroundTertiary, label: 'Not set up' },
  };
  const t = tone[c.urgency];
  const shown = c.services.filter(s => s.state === 'overdue' || s.state === 'due');
  const lines = shown.length ? shown : c.services.slice(0, 1);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.candidate, { borderColor: selected ? colors.primary : colors.border }, pressed && { opacity: 0.7 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${c.label}, ${t.label}`}
    >
      <Icon name={selected ? 'check-circle' : 'circle'} size={24} color={selected ? colors.primary : colors.border} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.candidateTop}>
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600', flex: 1 }]} numberOfLines={1}>{c.label}</Text>
          <View style={[styles.pill, { backgroundColor: t.bg }]}>
            <Text style={[typeScale.caption, { color: t.fg, fontWeight: '700' }]}>{t.label}</Text>
          </View>
        </View>
        <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>
          {c.customerName ? `${c.customerName} · ` : ''}{c.address}
        </Text>
        {lines.map(s => (
          <View key={s.serviceId}>
            <Text style={[typeScale.bodySmall, { color: s.state === 'overdue' ? colors.error : colors.textPrimary, fontWeight: '600' }]}>{serviceLine(s)}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{serviceDetail(s)}</Text>
          </View>
        ))}
        {c.alreadyRouted && (
          <Text style={[typeScale.caption, { color: colors.warning, fontWeight: '600' }]}>Already on a route this day</Text>
        )}
      </View>
    </Pressable>
  );
}

function IconButton({ name, label, onPress, disabled }: { name: 'arrow-up' | 'arrow-down' | 'x' | 'plus'; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.backgroundTertiary, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Icon name={name} size={16} color={colors.textPrimary} />
    </Pressable>
  );
}

function LeadBadge() {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: colors.primarySurface }]}>
      <Text style={[typeScale.caption, { color: colors.primaryDark, fontWeight: '700' }]}>Lead</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  dateChip: { width: 56, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  candidate: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5 },
  candidateTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  linkRow: { paddingVertical: spacing.sm, alignItems: 'center' },
  stop: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stopNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stopBody: { gap: spacing.sm, marginTop: spacing.xs },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  secondaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    height: 48, borderRadius: radius.full, borderWidth: 1.5,
  },
  reviewStop: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    height: 56, borderRadius: radius.full,
  },
});
