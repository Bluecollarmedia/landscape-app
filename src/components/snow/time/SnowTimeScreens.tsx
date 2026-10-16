/**
 * Snow time clock (update 028). Worker: Clock In / Clock Out and this
 * week's shifts. Owner: everyone's shifts this week with totals, and a
 * one-tap "Clock out now" correction for a shift someone forgot to end.
 * Working layout in the existing app style; no approved mockup yet.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, InlineNotice, LoadingSpinner, ScreenHeader } from '@/components/ui';
import { confirmAction, showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  clockIn, clockOut, correctShift, formatClock, formatHours, loadShifts, shiftHours, startOfWeekIso, type SnowShift,
} from '@/data/snowShifts';
import { ShiftCorrectionSheet } from './ShiftCorrectionSheet';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

function useShifts() {
  const [shifts, setShifts] = useState<SnowShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const res = await loadShifts(startOfWeekIso());
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setShifts(res.data);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { shifts, error, loading, reload, setShifts };
}

function ShiftRow({ s, first, name, action }: { s: SnowShift; first: boolean; name?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}>
      <View style={{ flex: 1, gap: 2 }}>
        {name ? <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{name}</Text> : null}
        <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
          {formatClock(s.clockInAt)} – {s.clockOutAt ? new Date(s.clockOutAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'now'}
        </Text>
        {s.corrected ? (
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Corrected: {s.correctionReason}</Text>
        ) : null}
        {action}
      </View>
      <Text style={[typeScale.labelLarge, { color: s.clockOutAt ? colors.textSecondary : colors.primary }]}>{formatHours(shiftHours(s))}</Text>
    </View>
  );
}

/** Worker "Time" tab. */
export function SnowTimeClockScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { shifts, error, loading, reload } = useShifts();
  const [busy, setBusy] = useState(false);
  const open = shifts.find((s) => !s.originalOut);
  const week = shifts.reduce((t, s) => t + shiftHours(s), 0);

  async function toggle() {
    setBusy(true);
    const res = open ? await clockOut() : await clockIn();
    setBusy(false);
    if (!res.ok) showMessage(open ? 'Couldn\'t clock out' : 'Couldn\'t clock in', res.error);
    reload();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance + spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      >
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Time Clock</Text>
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginTop: spacing.md }} /> : null}
        {loading ? <LoadingSpinner /> : (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.md, alignItems: 'center', gap: spacing.sm }]}>
              <Text style={[typeScale.overline, { color: colors.textSecondary }]}>{open ? 'Clocked in' : 'Not clocked in'}</Text>
              <Text style={[typeScale.displaySmall, { color: open ? colors.primary : colors.textPrimary }]}>
                {open ? formatHours(shiftHours(open)) : formatHours(week)}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                {open ? `Since ${formatClock(open.clockInAt)}` : 'This week'}
              </Text>
              <Button
                title={open ? 'Clock Out' : 'Clock In'}
                icon={open ? 'log-out' : 'log-in'}
                variant={open ? 'danger' : 'primary'}
                loading={busy}
                onPress={toggle}
                fullWidth
                style={{ marginTop: spacing.sm }}
              />
              <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
                No location is used. Snow hours are kept apart from landscaping hours.
              </Text>
            </View>

            <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>This week · {formatHours(week)}</Text>
            {shifts.length ? (
              <View style={[styles.group, { backgroundColor: colors.surface }]}>
                {shifts.map((s, i) => <ShiftRow key={s.id} s={s} first={i === 0} />)}
              </View>
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginHorizontal: spacing.sm }]}>No shifts yet this week.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Owner "Snow hours": everyone's shifts this week. */
export function SnowHoursScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { shifts, error, loading, reload } = useShifts();
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<SnowShift | null>(null);

  useEffect(() => {
    const ids = [...new Set(shifts.map((s) => s.personId))].filter((id) => !names[id]);
    if (!ids.length || !isSupabaseConfigured) return;
    supabase.from('people').select('id, first_name, last_name').in('id', ids).then(({ data }) => {
      const next = { ...names };
      for (const p of data ?? []) next[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed';
      setNames(next);
    });
  }, [shifts, names]);

  const totals = new Map<string, number>();
  for (const s of shifts) totals.set(s.personId, (totals.get(s.personId) ?? 0) + shiftHours(s));

  function clockOutNow(s: SnowShift) {
    const who = names[s.personId] ?? 'this person';
    confirmAction(`Clock out ${who} now?`, 'Their original clock-in stays on record; this adds a correction.', 'Clock out', async () => {
      const res = await correctShift(s.id, s.clockInAt, new Date().toISOString(), 'Clocked out by the owner');
      if (!res.ok) showMessage('Couldn\'t clock them out', res.error);
      reload();
    });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title="Snow hours" subtitle="This week" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      >
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}
        {loading ? <LoadingSpinner /> : (
          <>
            {totals.size ? (
              <View style={[styles.group, { backgroundColor: colors.surface }]}>
                {[...totals.entries()].sort((a, b) => b[1] - a[1]).map(([pid, h], i) => (
                  <View key={pid} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}>
                    <Text style={[typeScale.bodyLarge, { flex: 1, color: colors.textPrimary }]}>{names[pid] ?? '…'}</Text>
                    <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>{formatHours(h)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginHorizontal: spacing.sm }]}>Nobody has clocked in this week.</Text>
            )}
            {shifts.length ? (
              <>
                <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Shifts</Text>
                <View style={[styles.group, { backgroundColor: colors.surface }]}>
                  {shifts.map((s, i) => (
                    <ShiftRow
                      key={s.id}
                      s={s}
                      first={i === 0}
                      name={names[s.personId]}
                      action={(
                        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                          <Button title="Correct times" size="sm" variant="secondary" onPress={() => setEditing(s)} />
                          {!s.originalOut ? <Button title="Clock out now" size="sm" variant="secondary" onPress={() => clockOutNow(s)} /> : null}
                        </View>
                      )}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <ShiftCorrectionSheet
        shift={editing}
        who={editing ? names[editing.personId] : undefined}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  label: { marginLeft: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.xl },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
});
