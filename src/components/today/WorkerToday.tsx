import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useDayWork, type DayWork } from '@/hooks/useDayWork';
import { useStopActions } from '@/hooks/useStopActions';
import { WorkdayCard } from '@/components/time/WorkdayCard';
import { TodayHeader } from '@/components/today/TodayHeader';
import { StopCard, type StopCardState } from '@/components/today/StopCard';
import { JobCard } from '@/components/today/JobCard';
import type { DayItem } from '@/lib/dayWork';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { useT } from '@/i18n';

const SHEET_RADIUS = 28;

function useGreeting() {
  const t = useT();
  const h = new Date().getHours();
  return h < 12 ? t('Good morning') : h < 17 ? t('Good afternoon') : t('Good evening');
}

function Sheet({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useTheme();
  const clearance = useTabBarClearance();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.groupedBackground }} contentContainerStyle={{ paddingBottom: clearance + spacing.xl }} showsVerticalScrollIndicator={false}>
      {header}
      <View style={[styles.sheet, { backgroundColor: colors.groupedBackground }]}>{children}</View>
    </ScrollView>
  );
}

function Message({ icon, title, text }: { icon: keyof typeof Feather.glyphMap; title: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.message}>
      <View style={[styles.messageIcon, { backgroundColor: colors.primarySurface }]}><Feather name={icon} size={30} color={colors.primaryDark} /></View>
      <Text style={[typeScale.headingLarge, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }]}>{title}</Text>
      <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>{text}</Text>
    </View>
  );
}

/** Before the worker has clocked in (or when work remains after a closed session): a greeting and ONE Clock In button. No route. */
export function ClockInScreen({ moreWork }: { moreWork?: boolean }) {
  const t = useT();
  const greeting = useGreeting();
  return (
    <Sheet header={<TodayHeader greeting title={greeting} subtitle={t("Here's your route for today.")} />}>
      <WorkdayCard
        gate
        preShiftTitle={moreWork ? t('You have more work today') : t("Clock in to see today's work")}
        preShiftText={t('Clock in when you start work at the yard.')}
      />
    </Sheet>
  );
}

/**
 * The worker's Today once there is a running day. No clock at all (no timer, total, Clock Out or warnings): the day's time is recorded in the
 * background and the only clock-out is the small row in Settings. `combined` lists route stops AND jobs together; otherwise only route stops.
 */
export function WorkerToday({ combined = false }: { combined?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { workday: w } = useWorkerContext();
  const day = useDayWork();
  const actions = useStopActions();
  const greeting = useGreeting();

  if (w.installed === null) return <Sheet header={<TodayHeader title={t('Today')} />}>{null}</Sheet>;

  const items: DayItem[] = combined ? day.items : day.stops;
  const anyWork = items.length > 0;
  const openWork = items.some((i) => !i.done);
  const active = !!w.active;
  const closedToday = !active && !!w.today?.clockOutAt;

  // Not clocked in: only a way to clock in (when there is something to do), never the route.
  if (!active) {
    if (!anyWork) {
      return (
        <Sheet header={<TodayHeader title={t('Today')} />}>
          <Message icon="calendar" title={t('No route today')} text={t("You're all set. There are no stops for you today.")} />
        </Sheet>
      );
    }
    if (closedToday && !openWork) {
      return (
        <Sheet header={<TodayHeader title={t('Today')} />}>
          <Message icon="check-circle" title={t('All done for today!')} text={t('Great work. Your work is complete.')} />
        </Sheet>
      );
    }
    return <ClockInScreen moreWork={closedToday} />;
  }

  const nextId = items.find((i) => !i.done)?.id;
  let lastRouteId: string | undefined;
  return (
    <Sheet header={<TodayHeader title={t('Today')} subtitle={anyWork ? undefined : greeting} />}>
      {!anyWork ? (
        <Message icon="calendar" title={t('No route today')} text={t("You're all set. There are no stops for you today.")} />
      ) : (
        <>
          {!openWork ? (
            <Message icon="check-circle" title={t('All done for today!')} text={t('Great work. Your workday ends when you clock out in Settings.')} />
          ) : null}
          {items.map((item) => {
            const state: StopCardState = item.done ? 'done' : item.id === nextId ? 'next' : 'later';
            if (item.kind === 'job') {
              lastRouteId = undefined;
              return <JobCard key={`j-${item.id}`} job={item.job} state={state} onOpen={() => router.push(`/(worker)/job/${item.job.id}` as any)} />;
            }
            const showRoute = day.routes.length > 1 && lastRouteId !== item.route.id;
            lastRouteId = item.route.id;
            return (
              <View key={`s-${item.id}`}>
                {showRoute ? <Text style={[typeScale.overline, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }]}>{(item.route.name || t('Route')).toUpperCase()}</Text> : null}
                <StopCard
                  stop={item.stop}
                  route={item.route}
                  state={state}
                  leader={actions.isLeader(item.route)}
                  starting={actions.startingStopId === item.stop.id}
                  onOpen={() => actions.open(item.stop)}
                  onArrive={() => actions.arrive(item.stop)}
                  onFinish={() => actions.finish(item.stop)}
                  onDirections={() => actions.directions(item.stop)}
                />
              </View>
            );
          })}
        </>
      )}
    </Sheet>
  );
}

export type { DayWork };

const styles = StyleSheet.create({
  sheet: { marginTop: -SHEET_RADIUS, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  message: { alignItems: 'center', paddingVertical: spacing['3xl'], paddingHorizontal: spacing.lg },
  messageIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
