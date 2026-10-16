import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useMyMaintenanceRoute } from '@/hooks/useMaintenance';
import { db } from '@/data/store';
import { ScreenContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { RouteProgress } from '@/components/maintenance/RouteProgress';
import { StopRow } from '@/components/maintenance/StopRow';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';

const nameOf = (personId?: string) => (personId ? db.people[personId]?.firstName : undefined);

/** The whole route in the owner's saved order: done stops stay in place with their finish times. */
export default function MaintenanceRouteScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const route = useMyMaintenanceRoute();
  const stops = route?.stops ?? [];
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScreenContainer scrollable padded variant="grouped">
      <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.lg }}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>{route?.name || 'Route'}</Text>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{dateStr}</Text>
      </View>

      {!route ? (
        <EmptyState icon="map" title="No route today" description="When the owner puts you on a maintenance route, every stop shows up here in order." />
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.surface }, shadow.sm]}>
            {stops.length > 0 ? (
              <RouteProgress stops={stops} nextStopId={route.nextStop?.id} />
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>This route doesn't have any stops yet.</Text>
            )}
            <View style={styles.metaRow}>
              <Feather name="users" size={13} color={colors.textTertiary} />
              <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textSecondary }]} numberOfLines={2}>
                {route.crew.map(p => `${p.firstName} ${p.lastName}`.trim()).join(', ') || 'No crew assigned'}
              </Text>
            </View>
            {route.lead && (
              <View style={styles.metaRow}>
                <Feather name="star" size={13} color={colors.textTertiary} />
                <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textSecondary }]}>
                  Lead: {route.lead.firstName} {route.lead.lastName}
                </Text>
              </View>
            )}
            {route.notes ? (
              <View style={[styles.note, { backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="file-text" size={14} color={colors.textSecondary} />
                <Text style={[typeScale.bodySmall, styles.metaText, { color: colors.textPrimary, flex: 1 }]}>{route.notes}</Text>
              </View>
            ) : null}
          </View>

          {stops.length > 0 && (
            <>
              <Text style={[typeScale.headingSmall, { color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
                {stops.length} stop{stops.length === 1 ? '' : 's'}
              </Text>
              <View style={[styles.listCard, { backgroundColor: colors.surface }, shadow.sm]}>
                {stops.map((s, i) => (
                  <StopRow
                    key={s.id}
                    stop={s}
                    nextStopId={route.nextStop?.id}
                    nameOf={nameOf}
                    first={i === 0}
                    showInstructions={s.status === 'pending' || s.status === 'arrived'}
                    onPress={() => router.push(`/(worker)/maintenance-stop/${s.id}` as any)}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.lg },
  listCard: { borderRadius: radius.xl, overflow: 'hidden' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  metaText: { marginLeft: spacing.xs, flexShrink: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.sm },
});
