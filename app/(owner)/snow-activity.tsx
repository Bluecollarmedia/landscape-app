/**
 * Snow Mode activity log (Owner). Everything that happened in Snow Mode,
 * newest first, filterable by storm, route, worker, property and action.
 *
 * Working layout only: the approved Snow Mode design for this screen hasn't
 * been supplied yet. The data, filters and paging are real.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, RefreshControl, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { EmptyState } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import {
  useSnowActivity, type SnowActivityEntry, type SnowActivityFilters, type SnowFilterKind, type SnowFilterOption,
} from '@/hooks/useSnowActivity';
import { actionIcon, actionLabel, entityLabel, fieldChanges } from '@/lib/snowActivity';

const FILTERS: { kind: SnowFilterKind; label: string; field: keyof SnowActivityFilters }[] = [
  { kind: 'storm', label: 'Storm', field: 'stormId' },
  { kind: 'route', label: 'Route', field: 'routeId' },
  { kind: 'worker', label: 'Worker', field: 'personId' },
  { kind: 'property', label: 'Property', field: 'propertyId' },
  { kind: 'action', label: 'Action', field: 'action' },
];

const SERVICE_LABEL: Record<string, string> = { plowing: 'Plowing', shoveling: 'Shoveling', salting: 'Salting' };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** A name for a filter choice, even when the log never recorded one. */
function optionLabel(o: SnowFilterOption): string {
  if (o.kind === 'action') return actionLabel(o.value);
  if (o.label) return o.label;
  const fallback = { storm: 'Unnamed storm', route: 'Unnamed route', property: 'Unnamed property', worker: 'Unknown person' }[o.kind];
  return `${fallback} · ${shortDate(o.lastAt)}`;
}

export default function SnowActivityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [filters, setFilters] = useState<SnowActivityFilters>({});
  const [picking, setPicking] = useState<SnowFilterKind | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { events, options, loading, loadingMore, hasMore, error, reload, loadMore } = useSnowActivity(filters);

  const labelOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of options) map.set(`${o.kind}:${o.value}`, optionLabel(o));
    return (kind: SnowFilterKind, value?: string) => (value ? map.get(`${kind}:${value}`) : undefined);
  }, [options]);

  const activeCount = FILTERS.filter((f) => filters[f.field]).length;

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  function choose(kind: SnowFilterKind, value?: string) {
    const field = FILTERS.find((f) => f.kind === kind)!.field;
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPicking(null);
    setExpandedId(null);
  }

  function renderEvent({ item: e }: { item: SnowActivityEntry }) {
    const isExpanded = expandedId === e.id;
    const who = e.actorName ?? (e.actorId ? 'Someone' : 'System');
    const context = [
      labelOf('storm', e.stormId),
      labelOf('route', e.routeId),
      labelOf('property', e.propertyId),
      e.service ? SERVICE_LABEL[e.service] ?? e.service : undefined,
    ].filter(Boolean).join(' · ');
    const about = e.personName && e.personId !== e.actorId ? e.personName : undefined;
    const changes = isExpanded ? fieldChanges(e.before ?? null, e.after ?? null) : [];

    return (
      <Pressable
        onPress={() => setExpandedId(isExpanded ? null : e.id)}
        style={[styles.row, { borderBottomColor: colors.borderLight }]}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel(e.action)} by ${who}, ${formatTime(e.occurredAt)}`}
        accessibilityHint={isExpanded ? 'Hides the details' : 'Shows what changed'}
      >
        <View style={[styles.rowIcon, { backgroundColor: colors.backgroundTertiary }]}>
          <Icon name={actionIcon(e.action)} size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600', flex: 1 }]} numberOfLines={2}>
              {actionLabel(e.action)}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{formatTime(e.occurredAt)}</Text>
          </View>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {who}{about ? ` → ${about}` : ''}
          </Text>
          {context ? (
            <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={isExpanded ? undefined : 1}>
              {context}
            </Text>
          ) : null}

          {isExpanded && (
            <View style={[styles.details, { borderTopColor: colors.borderLight }]}>
              {e.note ? (
                <Text style={[typeScale.bodySmall, { color: colors.textPrimary, marginBottom: spacing.sm }]}>{e.note}</Text>
              ) : null}
              {changes.length === 0 ? (
                <Text style={[typeScale.caption, { color: colors.textTertiary }]}>No field details recorded.</Text>
              ) : (
                changes.map((c) => (
                  <View key={c.field} style={styles.change}>
                    <Text style={[typeScale.overline, { color: colors.textTertiary }]}>{c.field.toUpperCase()}</Text>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                      {c.before !== undefined && c.after !== undefined
                        ? `${c.before} → ${c.after}`
                        : c.after ?? `was ${c.before}`}
                    </Text>
                  </View>
                ))
              )}
              <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                {entityLabel(e.entityType)} record · {new Date(e.occurredAt).toLocaleString('en-US')}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  const pickingFilter = FILTERS.find((f) => f.kind === picking);
  const pickOptions = options.filter((o) => o.kind === picking);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
          Snow Activity
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar} style={styles.filterScroll}>
        {FILTERS.map((f) => {
          const value = filters[f.field];
          const on = !!value;
          return (
            <Pressable
              key={f.kind}
              onPress={() => setPicking(f.kind)}
              style={[styles.chip, {
                backgroundColor: on ? colors.primary : colors.backgroundTertiary,
                borderColor: on ? colors.primary : colors.borderLight,
              }]}
              accessibilityRole="button"
              accessibilityLabel={on ? `${f.label}: ${labelOf(f.kind, value)}. Change filter` : `Filter by ${f.label.toLowerCase()}`}
            >
              <Text style={[typeScale.labelSmall, { color: on ? colors.textOnPrimary : colors.textPrimary }]} numberOfLines={1}>
                {on ? labelOf(f.kind, value) ?? f.label : f.label}
              </Text>
              <Icon name="chevron-down" size={14} color={on ? colors.textOnPrimary : colors.textSecondary} />
            </Pressable>
          );
        })}
        {activeCount > 0 && (
          <Pressable onPress={() => setFilters({})} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear all filters">
            <Text style={[typeScale.labelSmall, { color: colors.primary }]}>Clear</Text>
          </Pressable>
        )}
      </ScrollView>

      {error ? (
        <Text style={[typeScale.bodySmall, styles.error, { color: semantic.error }]}>{error}</Text>
      ) : null}

      {loading && events.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          renderItem={renderEvent}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                icon="activity"
                title={activeCount > 0 ? 'Nothing matches these filters' : 'No snow activity yet'}
                description={activeCount > 0
                  ? 'Try removing a filter.'
                  : 'Storms, routes, stops, media and time records show up here as soon as they change.'}
                actionTitle={activeCount > 0 ? 'Clear filters' : undefined}
                onAction={activeCount > 0 ? () => setFilters({}) : undefined}
              />
            )
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.primary} />
            : !hasMore && events.length > 0 ? (
              <Text style={[typeScale.caption, styles.end, { color: colors.textTertiary }]}>Start of the log</Text>
            ) : null
          }
        />
      )}

      <BottomSheetModal visible={!!picking} onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.overlay} onPress={() => setPicking(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              Filter by {pickingFilter?.label.toLowerCase()}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {pickingFilter && [{ value: undefined as string | undefined, label: `Any ${pickingFilter.label.toLowerCase()}`, count: undefined as number | undefined }]
                .concat(pickOptions.map((o) => ({ value: o.value, label: optionLabel(o), count: o.count })))
                .map((o) => {
                  const selected = filters[pickingFilter.field] === o.value;
                  return (
                    <Pressable
                      key={o.value ?? 'any'}
                      onPress={() => choose(pickingFilter.kind, o.value)}
                      style={[styles.option, { borderBottomColor: colors.borderLight }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{o.label}</Text>
                      {o.count !== undefined && (
                        <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{o.count}</Text>
                      )}
                      {selected && <Icon name="check" size={18} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              {pickOptions.length === 0 && (
                <Text style={[typeScale.bodySmall, { color: colors.textTertiary, paddingVertical: spacing.md }]}>
                  Nothing logged yet.
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  filterScroll: { flexGrow: 0 },
  filterBar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 200,
    paddingHorizontal: spacing.md, minHeight: 36, borderRadius: radius.full, borderWidth: 1,
  },
  clear: { paddingHorizontal: spacing.sm, minHeight: 36, justifyContent: 'center' },
  error: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  details: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  change: { marginBottom: spacing.xs },
  end: { textAlign: 'center', marginVertical: spacing.lg },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
});
