import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ServiceIcon } from '@/components/maintenance/ServiceIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useMaintenanceCheckIn } from '@/hooks/useMaintenanceCheckIn';
import { useMyMaintenanceRoute } from '@/hooks/useMaintenance';
import { useDb, db } from '@/data/store';
import { locationLabel } from '@/data/maintenance';
import { missingRequirements, finishStopAndAdvance, useFinishingStop } from '@/data/maintenanceFinish';
import { haptics } from '@/lib/haptics';
import { EmptyState } from '@/components/ui';
import { BrandCover } from '@/components/branding/BrandCover';
import { JobMap } from '@/components/maps/JobMap';
import { YardStartCard } from '@/components/maintenance/YardStartCard';
import { RouteProgress } from '@/components/maintenance/RouteProgress';
import { StopRow, StopStatusPill } from '@/components/maintenance/StopRow';
import { displayStatus } from '@/components/maintenance/types';
import { formatClock, servicesLabel, stopAddress } from '@/components/maintenance/format';
import { getWorkerHeaderImageUri } from '@/lib/projectImages';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { MaintenanceStopDetail } from '@/types/maintenance';

const HERO_HEIGHT = 210;
/** The white sheet's rounded top edge overlaps the photo by this much. */
const SHEET_RADIUS = 28;
/** Room the fixed action button takes at the bottom of the scroll. */
const ACTION_AREA = 96;

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function firstName(personId?: string): string | undefined {
  return personId ? db.people[personId]?.firstName : undefined;
}

/**
 * Maintenance worker home: today's route first. The crew shares one route,
 * so every member sees the same order, instructions and progress. The single
 * button at the bottom follows the day: Start Day, then I'm Here and Finish
 * Stop for each stop in the owner's order.
 */
export default function MaintenanceTodayScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const { openMapsNavigation } = useWorkerContext();
  const checkIn = useMaintenanceCheckIn();
  const { yard, yardName, dayStart } = checkIn;
  useDb();

  const route = useMyMaintenanceRoute();
  const stops = route?.stops ?? [];
  const next = route?.nextStop;
  const upcoming = stops.filter(s => s.status === 'pending' || s.status === 'arrived');
  const allDone = !!route && stops.length > 0 && !next;

  // Shared with the stop screen, so a tap in either place can't finish twice.
  const finishing = useFinishingStop(next?.id);
  const busy = finishing || checkIn.busy != null;
  // A worker who goes straight to a property (missed the yard) can still work;
  // their day start stays missing for the owner to see.
  const [skippedYard, setSkippedYard] = useState(false);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Start Day and I'M HERE (with their honest GPS prompts) come from useMaintenanceCheckIn.
  const handleStartDay = () => { haptics.select(); checkIn.startDay(route?.id); };
  const handleArrive = (stop: MaintenanceStopDetail) => { haptics.select(); checkIn.arriveAtStop(stop.id); };
  async function handleFinish(stop: MaintenanceStopDetail) {
    if (busy) return;
    if (missingRequirements(stop).length) {
      haptics.warning();
      // The stop screen is where the checklist and photos get done.
      openStop(stop);
      return;
    }
    haptics.select();
    const result = await finishStopAndAdvance(stop.id);
    if (result.ok) haptics.success();
    else if (result.missing.length) openStop(stop);
    else {
      haptics.warning();
      showMessage("Couldn't save that", result.error ?? 'Please try again.');
    }
  }

  function openStop(stop: MaintenanceStopDetail) {
    router.push(`/(worker)/maintenance-stop/${stop.id}` as any);
  }

  // ── Bottom action: one primary button for where the worker is in the day ──
  let action: { title: string; subtitle: string; icon: keyof typeof Feather.glyphMap; onPress: () => void; muted?: boolean } | null = null;
  // Each worker checks in at each stop themselves, even when a crewmate got there first.
  const iCheckedIn = next ? !!checkIn.arrivalFor(next.id)?.mine : false;
  if (!dayStart.started && !skippedYard && !allDone) {
    action = {
      title: 'START DAY',
      subtitle: checkIn.busy === 'day' ? 'Finding your location…' : `Check in at ${yardName}`,
      icon: 'sunrise',
      onPress: handleStartDay,
    };
  } else if (next && (next.status === 'pending' || !iCheckedIn)) {
    action = {
      title: "I'M HERE",
      subtitle: checkIn.busy === next.id ? 'Finding your location…' : 'Check in to start this stop',
      icon: 'map-pin',
      onPress: () => handleArrive(next),
    };
  } else if (next && next.status === 'arrived') {
    const blockers = missingRequirements(next);
    action = {
      title: 'FINISH STOP',
      subtitle: finishing
        ? 'Saving…'
        : blockers.length > 1 ? `${blockers[0]} and ${blockers.length - 1} more` : blockers[0] ?? 'Mark this property done',
      icon: 'check-circle',
      onPress: () => handleFinish(next),
      muted: blockers.length > 0,
    };
  }

  const scrollPadding = tabBarClearance + (action ? ACTION_AREA + (dayStart.started || !route ? 0 : 24) : 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scrollPadding }}>
        <View style={styles.hero}>
          <BrandCover uri={getWorkerHeaderImageUri()} style={styles.heroImage} />
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.18)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroText}>
            <Text style={[typeScale.bodySmall, styles.heroShadow, { color: '#FFFFFF' }]}>{dateStr}</Text>
            <Text style={[typeScale.displayLarge, styles.heroShadow, { color: '#FFFFFF', marginTop: 2 }]}>{greeting}</Text>
            <Text style={[typeScale.bodyLarge, styles.heroShadow, { color: '#FFFFFF', marginTop: spacing.xs }]}>
              {route ? "Here's your maintenance route for today." : 'Maintenance crew'}
            </Text>
          </View>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <YardStartCard
            dayStart={dayStart}
            yard={yard}
            yardName={yardName}
            onYardPress={yard ? () => { haptics.select(); openMapsNavigation(yard); } : undefined}
          />

          {!route ? (
            <EmptyState
              icon="map"
              title="No route today"
              description="When the owner puts you on a maintenance route, its stops show up here."
            />
          ) : (
            <View>
              <View style={styles.routeHeader}>
                <MaterialCommunityIcons name="map-marker-path" size={30} color={colors.primary} />
                <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>
                  Today's Route
                </Text>
              </View>
              {route.lead && (
                <View style={styles.leadRow}>
                  <Feather name="star" size={13} color={colors.textTertiary} />
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                    {route.lead.id === user?.id ? 'You are the route lead' : `Lead: ${route.lead.firstName} ${route.lead.lastName}`.trim()}
                  </Text>
                </View>
              )}
              {stops.length > 0 ? (
                <View style={{ marginTop: spacing.md }}>
                  <RouteProgress stops={stops} nextStopId={next?.id} />
                </View>
              ) : (
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                  This route doesn't have any stops yet.
                </Text>
              )}

              {route.notes ? (
                <View style={[styles.note, { backgroundColor: colors.backgroundSecondary, marginTop: spacing.md }]}>
                  <Feather name="file-text" size={14} color={colors.textSecondary} />
                  <Text style={[typeScale.bodySmall, styles.noteText, { color: colors.textPrimary }]}>{route.notes}</Text>
                </View>
              ) : null}

              {next && (
                <NextStopCard
                  stop={next}
                  onOpen={() => openStop(next)}
                  onDirections={next.property ? () => { haptics.select(); openMapsNavigation(next.property!); } : undefined}
                />
              )}

              {allDone && (
                <View style={[styles.doneBox, { backgroundColor: colors.primarySurface }]}>
                  <Feather name="check-circle" size={22} color={colors.primaryDark} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>Route complete</Text>
                    <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                      Every stop is finished. Nice work today.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {upcoming.length > 0 && (
            <View>
              <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Upcoming Stops
              </Text>
              <View style={[styles.listCard, { borderColor: colors.border }]}>
                {upcoming.map((s, i) => (
                  <StopRow
                    key={s.id}
                    stop={s}
                    nextStopId={next?.id}
                    first={i === 0}
                    showInstructions={s.id === next?.id}
                    onPress={() => openStop(s)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {action && (
        <View
          style={[styles.actionArea, { bottom: Platform.OS === 'ios' ? tabBarClearance - spacing.sm : spacing.md }]}
          pointerEvents="box-none"
        >
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', colors.surface, colors.surface]}
            locations={[0, 0.35, 1]}
            style={styles.actionFade}
          />
          <Pressable
            onPress={action.onPress}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel={`${action.title}. ${action.subtitle}`}
            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
          >
            <View style={[styles.actionButton, { backgroundColor: action.muted ? colors.primary : colors.primaryDark }]}>
              <View style={styles.actionRow}>
                <Feather name={action.icon} size={20} color="#FFFFFF" />
                <Text style={[typeScale.headingSmall, styles.actionTitle]}>{action.title}</Text>
              </View>
              <Text style={[typeScale.bodySmall, { color: 'rgba(255,255,255,0.9)', marginTop: 2 }]} numberOfLines={1}>
                {action.subtitle}
              </Text>
            </View>
          </Pressable>
          {action.title === 'START DAY' && next && (
            <Pressable
              onPress={() => { haptics.select(); setSkippedYard(true); }}
              hitSlop={8}
              style={styles.secondaryLink}
              accessibilityRole="button"
            >
              <Text style={[typeScale.labelLarge, { color: colors.primaryDark }]}>Already at a property? Check in there</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function NextStopCard({ stop, onOpen, onDirections }: { stop: MaintenanceStopDetail; onOpen: () => void; onDirections?: () => void }) {
  const { colors } = useTheme();
  const status = displayStatus(stop, stop.id);
  const requiredTasks = stop.tasks.filter(t => t.isRequired);
  const tasksDone = requiredTasks.filter(t => t.completedAt).length;
  const arrivedBy = firstName(stop.arrivedBy);

  return (
    <View style={[styles.nextCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.nextTop, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <View style={styles.nextTitleRow}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primarySurface }]}>
            <Feather name="home" size={16} color={colors.primaryDark} />
          </View>
          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={2}>
            {stop.property?.name ?? 'Property'}
          </Text>
        </View>
        <View style={styles.nextBody}>
          <View style={{ flex: 1 }}>
            <View style={styles.meta}>
              <Feather name="map-pin" size={13} color={colors.textTertiary} />
              <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textSecondary }]} numberOfLines={2}>
                {stopAddress(stop)}
              </Text>
            </View>
            <View style={styles.meta}>
              <ServiceIcon label={servicesLabel(stop)} size={15} color={colors.primary} />
              <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textSecondary }]} numberOfLines={2}>
                {servicesLabel(stop)}
              </Text>
            </View>
            <View style={[styles.meta, { marginTop: spacing.sm }]}>
              <StopStatusPill status={status} icon />
            </View>
          </View>
          {stop.property && <JobMap place={stop.property} height={92} style={styles.map} />}
        </View>
        {stop.status === 'arrived' && stop.arrivedAt && (
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.sm }]} numberOfLines={2}>
            Checked in {formatClock(stop.arrivedAt)}{arrivedBy ? ` by ${arrivedBy}` : ''} · {locationLabel(stop.arrivalLocationStatus)}
          </Text>
        )}
      </Pressable>

      {stop.instructions ? (
        <View style={[styles.note, { backgroundColor: colors.primarySurface, marginHorizontal: spacing.md }]}>
          <Feather name="info" size={14} color={colors.primaryDark} />
          <Text style={[typeScale.bodySmall, styles.noteText, { color: colors.textPrimary }]}>{stop.instructions}</Text>
        </View>
      ) : null}
      {stop.property?.accessNotes ? (
        <View style={[styles.note, { backgroundColor: colors.backgroundSecondary, marginHorizontal: spacing.md, marginTop: spacing.sm }]}>
          <Feather name="key" size={14} color={colors.textSecondary} />
          <Text style={[typeScale.bodySmall, styles.noteText, { color: colors.textPrimary }]}>{stop.property.accessNotes}</Text>
        </View>
      ) : null}

      {(requiredTasks.length > 0 || stop.requiresPhotos) && (
        <Pressable onPress={onOpen} style={styles.requirements} accessibilityRole="button">
          {requiredTasks.length > 0 && (
            <View style={styles.reqItem}>
              <Feather name="check-square" size={14} color={tasksDone === requiredTasks.length ? colors.success : colors.textSecondary} />
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                Checklist {tasksDone}/{requiredTasks.length}
              </Text>
            </View>
          )}
          {stop.requiresPhotos && (
            <View style={styles.reqItem}>
              <Feather name="camera" size={14} color={stop.photos.length >= stop.minPhotos ? colors.success : colors.textSecondary} />
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                Photos {Math.min(stop.photos.length, stop.minPhotos)}/{stop.minPhotos}
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {onDirections && (
        <Pressable
          onPress={onDirections}
          style={({ pressed }) => [styles.mapsRow, { borderTopColor: colors.border }, pressed && { backgroundColor: colors.surfacePressed }]}
          accessibilityRole="button"
          accessibilityLabel="Open in Maps"
        >
          <Feather name="navigation" size={16} color={colors.primary} />
          <Text style={[typeScale.bodyLarge, { color: colors.primary, flex: 1, marginLeft: spacing.sm, fontWeight: '600' }]}>
            Open in Maps
          </Text>
          <Feather name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: HERO_HEIGHT, width: '100%' },
  heroImage: { width: '100%', height: '100%' },
  heroText: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing['3xl'] + spacing.sm },
  heroShadow: { textShadowColor: 'rgba(0, 0, 0, 0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  sheet: {
    marginHorizontal: spacing.md,
    marginTop: -SHEET_RADIUS,
    padding: spacing.lg,
    gap: spacing.lg,
    borderRadius: SHEET_RADIUS,
  },
  routeHeader: { flexDirection: 'row', alignItems: 'center' },
  leadRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  headerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.sm, borderRadius: radius.sm },
  noteText: { marginLeft: spacing.xs, flex: 1 },
  nextCard: { marginTop: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  nextTop: { padding: spacing.md },
  nextBody: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xs },
  nextTitleRow: { flexDirection: 'row', alignItems: 'center' },
  map: { width: 104, borderRadius: radius.md, overflow: 'hidden', marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metaText: { marginLeft: spacing.xs, flexShrink: 1 },
  requirements: { flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  reqItem: { flexDirection: 'row', alignItems: 'center' },
  mapsRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneBox: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg },
  listCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  actionArea: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'stretch' },
  actionFade: { position: 'absolute', left: -spacing.lg, right: -spacing.lg, top: -spacing.xl, bottom: -spacing['3xl'] },
  actionButton: { height: 68, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionTitle: { color: '#FFFFFF', marginLeft: spacing.sm, fontWeight: '700', letterSpacing: 0.5 },
  secondaryLink: { alignSelf: 'center', marginTop: spacing.sm, paddingVertical: spacing.xs },
});
