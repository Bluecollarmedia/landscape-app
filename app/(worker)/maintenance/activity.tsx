import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useMaintenance } from '@/hooks/useMaintenance';
import { db } from '@/data/store';
import { locationLabel } from '@/data/maintenance';
import { localDateKey } from '@/lib/ids';
import { ScreenContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { formatClock } from '@/components/maintenance/format';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import type { MaintenanceEvent, MaintenanceEventType } from '@/types/maintenance';

const HISTORY_LIMIT = 200;

const EVENT_META: Partial<Record<MaintenanceEventType, { icon: keyof typeof Feather.glyphMap; verb: string }>> = {
  day_started: { icon: 'sunrise', verb: 'started the day' },
  arrived: { icon: 'map-pin', verb: 'arrived at' },
  task_checked: { icon: 'check-square', verb: 'checked off' },
  photo_added: { icon: 'camera', verb: 'added a photo at' },
  completed: { icon: 'check-circle', verb: 'finished' },
  skipped: { icon: 'skip-forward', verb: 'skipped' },
  correction: { icon: 'edit-3', verb: 'corrected a time' },
};

function dayHeading(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Maintenance history for the routes this worker was on: day starts,
 * arrivals, finished stops, checklist and photo activity, each with who did
 * it. Unticking a checklist item isn't shown; it's noise in a history.
 */
export default function MaintenanceActivityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const m = useMaintenance();

  const days = useMemo(() => {
    const myRoutes = new Set(m.routes.filter(r => r.crewIds.includes(db.personId)).map(r => r.id));
    const events = m.events
      .filter(e => EVENT_META[e.eventType] && (e.personId === db.personId || (e.routeId && myRoutes.has(e.routeId))))
      .slice(0, HISTORY_LIMIT);
    const groups: { key: string; events: MaintenanceEvent[] }[] = [];
    for (const e of events) {
      const key = localDateKey(new Date(e.occurredAt));
      const last = groups[groups.length - 1];
      if (last?.key === key) last.events.push(e);
      else groups.push({ key, events: [e] });
    }
    return groups;
  }, [m]);

  return (
    <ScreenContainer scrollable padded variant="grouped">
      <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.lg }}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Activity</Text>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>Your crew's maintenance work</Text>
      </View>

      {days.length === 0 ? (
        <EmptyState icon="activity" title="No activity yet" description="Day starts, arrivals and finished stops show up here." />
      ) : (
        days.map(day => (
          <View key={day.key} style={{ marginBottom: spacing.lg }}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, marginBottom: spacing.sm }]}>{dayHeading(day.key)}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }, shadow.sm]}>
              {day.events.map((e, i) => <EventRow key={e.id} event={e} first={i === 0} />)}
            </View>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

function EventRow({ event, first }: { event: MaintenanceEvent; first: boolean }) {
  const { colors } = useTheme();
  const meta = EVENT_META[event.eventType]!;
  const stop = event.stopId ? db.maintenance.stopById[event.stopId] : undefined;
  const isMe = event.personId === db.personId;
  const actor = isMe ? 'You' : event.actor ? event.actor.firstName : 'Someone';
  const taskTitle = event.eventType === 'task_checked' ? String(event.metadata?.title ?? 'a checklist item') : undefined;
  const target = taskTitle ? `${taskTitle}${stop?.property ? ` at ${stop.property.name}` : ''}` : stop?.property?.name;
  const showLocation = event.eventType === 'day_started' || event.eventType === 'arrived' || event.eventType === 'completed';
  const verified = event.locationStatus === 'verified';

  return (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: event.eventType === 'completed' ? colors.primarySurface : colors.backgroundTertiary }]}>
        <Feather name={meta.icon} size={15} color={event.eventType === 'completed' ? colors.primaryDark : colors.textSecondary} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
          <Text style={{ fontWeight: '600' }}>{actor}</Text> {meta.verb}{target ? ` ${target}` : ''}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          {formatClock(event.occurredAt)}
          {showLocation ? ` · ${verified ? 'GPS verified' : locationLabel(event.locationStatus)}` : ''}
          {event.note ? ` · ${event.note}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
