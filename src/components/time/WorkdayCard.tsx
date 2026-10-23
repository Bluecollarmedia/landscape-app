import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { clockText, durationText, intervalMs } from '@/lib/timeCalc';
import { haptics } from '@/lib/haptics';
import { StaleSessionCard } from '@/components/time/StaleSessionCard';
import type { TruckOptions } from '@/data/timeTracking';

function say(title: string, message: string) {
  if (Platform.OS === 'web') (globalThis as { alert?: (m: string) => void }).alert?.(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dayAndTime = (iso: string) => `${new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })} ${timeOfDay(iso)}`;

/**
 * The employee's workday: Clock In at the yard, the running day total, the truck, an optional break, and Clock Out. The timer runs
 * from the stored clock-in time (server time), so closing and reopening the app never resets it, and walking between properties
 * never restarts it. Shows nothing until the database update is installed (the older check-in screens keep working then).
 */
export function WorkdayCard({ compact = false, preShiftTitle, preShiftText }: { compact?: boolean; preShiftTitle?: string; preShiftText?: string } = {}) {
  const { colors } = useTheme();
  const { workday: w } = useWorkerContext();
  const [pickTruck, setPickTruck] = useState<TruckOptions | null>(null);
  const [loadingTrucks, setLoadingTrucks] = useState(false);
  // Only this card ticks every second (the timer); nothing else in the app is redrawn.
  const [, setTick] = useState(0);
  const running = !!w.active;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const nowMs = Date.now() + w.clockOffsetMs;
  const todayNetMs = w.netMsAt(nowMs);
  // A running day that began before today (an overnight job) is labelled with its day. A day open for much longer is never "running": it is `w.stale`.
  const fromEarlier = !!w.active && new Date(w.active.clockInAt).toDateString() !== new Date(nowMs).toDateString();

  if (w.installed !== true) return null;
  const active = w.active;
  const closedToday = !active ? w.today : undefined;
  const current = w.day?.current;
  // No route or job today: no Clock In button at all (the database refuses a clock-in too).
  const noWork = !active && w.day?.canClockIn === false;

  async function onClockIn() {
    haptics.select();
    setLoadingTrucks(true);
    const opts = await w.loadTrucks();
    setLoadingTrucks(false);
    if (!opts.ok) { say("Couldn't start your workday", opts.error); return; }
    // The owner already assigned a truck: use it, no choice to make. Otherwise let the worker pick (or go without).
    if (opts.data.assignedTruckId || opts.data.trucks.length === 0) { await doClockIn(undefined); return; }
    setPickTruck(opts.data);
  }
  async function doClockIn(truckId?: string) {
    setPickTruck(null);
    const r = await w.clockIn(truckId);
    if (r.ok) haptics.success(); else say("Couldn't start your workday", r.error);
  }
  function onClockOut() {
    haptics.select();
    const total = durationText(todayNetMs);
    const go = async () => { const r = await w.clockOut(); if (r.ok) haptics.success(); else say("Can't clock out yet", r.error); };
    Alert.alert('Clock out?', `Your total for today is ${total}.`, [{ text: 'Not yet', style: 'cancel' }, { text: 'Clock Out', style: 'destructive', onPress: go }]);
  }
  async function onBreak() {
    haptics.select();
    const r = w.onBreak ? await w.endBreak() : await w.startBreak();
    if (!r.ok) say(w.onBreak ? "Couldn't end the break" : "Couldn't start the break", r.error);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, shadow.md]}>
      {w.stale ? (
        <StaleSessionCard
          session={{ id: w.stale.id, clockInAt: w.stale.clockInAt, claimedOutAt: w.stale.claimedOutAt, claimNote: w.stale.claimNote, answered: !!w.stale.claimedAt }}
          busy={w.busy}
          nowMs={nowMs}
          onAnswer={(iso) => w.claimStale(w.stale!.id, iso)}
          error={w.error}
        />
      ) : null}
      {noWork && !closedToday ? (
        <>
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: colors.backgroundTertiary }]}><Feather name="calendar" size={18} color={colors.textSecondary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>No work scheduled today</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Clock In appears once you are put on a route or a job for the day.</Text>
            </View>
          </View>
        </>
      ) : null}

      {!active && !closedToday && !noWork ? (
        <>
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: colors.primarySurface }]}><Feather name="sunrise" size={18} color={colors.primaryDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>{preShiftTitle ?? 'Start your workday'}</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{preShiftText ?? 'Clock in when you start work at the yard.'}</Text>
            </View>
          </View>
          <Pressable onPress={onClockIn} disabled={w.busy || loadingTrucks} style={[styles.primary, { backgroundColor: colors.primary, opacity: w.busy || loadingTrucks ? 0.6 : 1 }]} accessibilityRole="button">
            {w.busy || loadingTrucks ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[typeScale.labelLarge, { color: '#FFFFFF' }]}>Clock In</Text>}
          </Pressable>
        </>
      ) : null}

      {active && compact ? (
        <>
          <View style={styles.head}>
            <View style={[styles.dot, { backgroundColor: w.onBreak ? colors.warning : colors.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>{w.onBreak ? 'On break' : 'On the clock'}</Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                since {fromEarlier ? dayAndTime(active.clockInAt) : timeOfDay(active.clockInAt)}{active.truck ? ` · ${active.truck.name}` : ''}
              </Text>
            </View>
            {w.day?.settings.breaksEnabled ? (
              <Pressable onPress={onBreak} disabled={w.busy} hitSlop={8} accessibilityRole="button" style={[styles.secondary, { borderColor: colors.border, opacity: w.busy ? 0.5 : 1 }]}>
                <Text style={[typeScale.labelSmall, { color: colors.textPrimary }]}>{w.onBreak ? 'End Break' : 'Break'}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClockOut} disabled={w.busy} hitSlop={8} accessibilityRole="button" style={[styles.secondary, { borderColor: colors.border, opacity: w.busy ? 0.5 : 1 }]}>
              <Text style={[typeScale.labelSmall, { color: colors.textPrimary }]}>Clock Out</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {active && !compact ? (
        <>
          <View style={styles.head}>
            <View style={[styles.dot, { backgroundColor: w.onBreak ? colors.warning : colors.success }]} />
            <Text style={[typeScale.overline, { color: colors.textSecondary, flex: 1 }]}>{w.onBreak ? 'ON BREAK' : 'WORKDAY'}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>since {fromEarlier ? dayAndTime(active.clockInAt) : timeOfDay(active.clockInAt)}</Text>
          </View>
          <Text style={[styles.timer, { color: colors.textPrimary }]} accessibilityLabel={`Workday total ${durationText(todayNetMs)}`}>{clockText(todayNetMs)}</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Workday total</Text>

          {active.truck ? (
            <View style={styles.row}>
              <Feather name="truck" size={14} color={colors.textTertiary} />
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{active.truck.name}{active.truck.source === 'owner' ? ' · assigned' : ''}</Text>
            </View>
          ) : null}
          {current ? (
            <View style={[styles.row, { marginTop: spacing.xs }]}>
              <Feather name="map-pin" size={14} color={colors.primary} />
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                At {current.label ?? 'a property'} · {durationText(intervalMs({ startedAt: current.startedAt, status: 'active' }, nowMs))}
              </Text>
            </View>
          ) : null}

          <View style={styles.buttons}>
            {w.day?.settings.breaksEnabled ? (
              <Pressable onPress={onBreak} disabled={w.busy || (!!current && !w.onBreak)} style={[styles.secondary, { borderColor: colors.border, opacity: w.busy || (!!current && !w.onBreak) ? 0.5 : 1 }]} accessibilityRole="button">
                <Feather name={w.onBreak ? 'play' : 'coffee'} size={15} color={colors.textPrimary} />
                <Text style={[typeScale.labelSmall, { color: colors.textPrimary }]}>{w.onBreak ? 'End Break' : 'Start Break'}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClockOut} disabled={w.busy} style={[styles.secondary, { borderColor: colors.border, opacity: w.busy ? 0.5 : 1 }]} accessibilityRole="button">
              <Feather name="log-out" size={15} color={colors.textPrimary} />
              <Text style={[typeScale.labelSmall, { color: colors.textPrimary }]}>Clock Out</Text>
            </Pressable>
          </View>
          {current && !w.onBreak ? (
            <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>Complete the property you are at before clocking out.</Text>
          ) : null}
        </>
      ) : null}

      {closedToday ? (
        <>
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: colors.successLight ?? colors.primarySurface }]}><Feather name="check" size={18} color={colors.success} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>Workday complete</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                Total {durationText(todayNetMs)} · {timeOfDay(closedToday.clockInAt)} to {closedToday.clockOutAt ? timeOfDay(closedToday.clockOutAt) : ''}
              </Text>
            </View>
          </View>
          {w.day?.canClockIn !== false ? (
            <Pressable onPress={onClockIn} disabled={w.busy || loadingTrucks} hitSlop={8} style={{ marginTop: spacing.sm }}>
              <Text style={[typeScale.labelSmall, { color: colors.primary }]}>Clocked out by mistake? Clock back in</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {w.error ? <Text style={[typeScale.caption, { color: colors.error, marginTop: spacing.sm }]}>{w.error}</Text> : null}

      <BottomSheetModal visible={!!pickTruck} onRequestClose={() => setPickTruck(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPickTruck(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, textAlign: 'center' }]}>Which truck are you taking?</Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md }]}>No truck has been assigned to you today.</Text>
            {pickTruck?.trucks.map((t) => (
              <Pressable key={t.id} disabled={t.inUse} onPress={() => doClockIn(t.id)} style={[styles.truckRow, { borderColor: colors.borderLight, opacity: t.inUse ? 0.45 : 1 }]} accessibilityRole="button">
                <Feather name="truck" size={18} color={colors.textPrimary} />
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{t.name}</Text>
                {t.inUse ? <Text style={[typeScale.caption, { color: colors.textTertiary }]}>In use</Text> : null}
              </Pressable>
            ))}
            <Pressable onPress={() => doClockIn(undefined)} style={[styles.truckRow, { borderColor: colors.borderLight }]} accessibilityRole="button">
              <Feather name="slash" size={18} color={colors.textSecondary} />
              <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>No truck today</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  timer: { fontSize: 44, lineHeight: 52, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  primary: { height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondary: { flex: 1, height: 44, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing['3xl'] },
  truckRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
});
