import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, InlineNotice, LoadingSpinner, ProgressBar, StatusBadge } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useSnowDashboard } from '@/hooks/useSnowDashboard';
import { SERVICE_LABEL, LONG_OPEN_SHIFT_HOURS, type AttentionItem, type StormOverview } from '@/data/snowDashboard';
import { snowDashboardHref } from '@/lib/snowLinks';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

/**
 * Owner Snow dashboard, plain working version: Needs Attention, then Storm
 * Overview, as two separate sections. Layout and styling are placeholders
 * until the approved mockup for this screen arrives; the data comes from
 * useSnowDashboard and is real.
 */
export function SnowDashboard({ topInset = 0, bottomInset = 0 }: { topInset?: number; bottomInset?: number }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { state, storms, needsAttention, shiftsChecked, refreshing, onRefresh, reload } = useSnowDashboard();

  if (state.kind === 'loading') {
    return <View style={[styles.center, { backgroundColor: colors.groupedBackground }]}><LoadingSpinner /></View>;
  }
  if (state.kind === 'unavailable') {
    return (
      <View style={[styles.center, { backgroundColor: colors.groupedBackground }]}>
        <EmptyState icon="cloud-snow" title="Snow data isn't available" description={state.reason} />
      </View>
    );
  }

  const open = (item: AttentionItem) => {
    const href = snowDashboardHref(item.target);
    if (href) router.push(href as any);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ paddingTop: topInset + spacing.md, paddingBottom: bottomInset + spacing['3xl'], paddingHorizontal: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {state.kind === 'error' && (
        <Pressable onPress={reload} accessibilityRole="button" accessibilityLabel="Couldn't refresh. Tap to try again">
          <InlineNotice icon="alert-triangle" tone="error" text={`Couldn't refresh: ${state.message}. Tap to try again.`} style={{ marginBottom: spacing.md }} />
        </Pressable>
      )}

      <Text style={[typeScale.headingSmall, styles.sectionTitle, { color: colors.textPrimary }]}>
        Needs Attention{needsAttention.length ? ` (${needsAttention.length})` : ''}
      </Text>
      {!shiftsChecked && (
        <InlineNotice
          icon="clock"
          tone="neutral"
          text="Time records aren't checked yet: snow clock in and out isn't set up on this database."
          style={{ marginBottom: spacing.sm }}
        />
      )}
      {needsAttention.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>Nothing is waiting on you.</Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, paddingVertical: 0 }]}>
          {needsAttention.map((item, i) => {
            const tappable = !!snowDashboardHref(item.target);
            return (
              <Pressable
                key={item.key}
                onPress={() => open(item)}
                disabled={!tappable}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityRole={tappable ? 'button' : undefined}
                accessibilityLabel={`${item.title}. ${item.detail}`}
              >
                <Icon name={ATTENTION_ICON[item.kind]} size={20} color={colors.textPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{item.title}</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{item.detail}</Text>
                </View>
                {tappable && <Icon name="chevron-right" size={18} color={colors.textTertiary} />}
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={[typeScale.headingSmall, styles.sectionTitle, { color: colors.textPrimary, marginTop: spacing.xl }]}>
        Storm Overview
      </Text>
      {storms.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>No active or planned storms.</Text>
        </View>
      ) : storms.map((s) => <StormCard key={s.id} storm={s} />)}

      {shiftsChecked && (
        <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.lg }]}>
          Shifts open longer than {LONG_OPEN_SHIFT_HOURS} hours are listed as a possible missed clock-out.
        </Text>
      )}
    </ScrollView>
  );
}

const ATTENTION_ICON: Record<AttentionItem['kind'], 'skip-forward' | 'camera' | 'user-x' | 'clock'> = {
  skip_request: 'skip-forward',
  missing_media: 'camera',
  route_without_lead: 'user-x',
  open_shift: 'clock',
};

function StormCard({ storm }: { storm: StormOverview }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: spacing.md }]}>
      <View style={styles.stormHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>{storm.name}</Text>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            {SERVICE_LABEL[storm.service]}
            {storm.reopenedCount > 0 ? ` · Reopened${storm.reopenedCount > 1 ? ` ${storm.reopenedCount}×` : ''}` : ''}
          </Text>
        </View>
        <StatusBadge
          label={storm.status === 'draft' ? 'Not dispatched' : 'Dispatched'}
          status={storm.status === 'draft' ? 'neutral' : 'info'}
        />
      </View>

      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
        {storm.completed} completed · {storm.remaining} remaining{storm.skipped ? ` · ${storm.skipped} skipped` : ''} · {storm.total} stops
        {storm.attentionCount ? ` · ${storm.attentionCount} need attention` : ''}
      </Text>
      <ProgressBar progress={storm.progress * 100} style={{ marginTop: spacing.xs }} />

      {storm.routes.length === 0 ? (
        <Text style={[typeScale.bodySmall, { color: colors.textTertiary, marginTop: spacing.sm }]}>No routes yet.</Text>
      ) : storm.routes.map((r) => (
        <View key={r.id} style={[styles.routeRow, { borderTopColor: colors.separator }]}>
          <View style={styles.routeTitle}>
            <Text style={[typeScale.bodyLarge, { color: r.cancelled ? colors.textTertiary : colors.textPrimary, fontWeight: '600', flex: 1 }]}>
              {r.name}{r.cancelled ? ' (cancelled)' : ''}
            </Text>
            {r.attentionCount > 0 && <StatusBadge label={`${r.attentionCount} need attention`} status="warning" />}
          </View>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            Lead: {r.leadName ?? 'Not assigned'}
            {r.mediaRequired ? ` · ${r.minMedia} photo${r.minMedia === 1 ? '' : 's'} required` : ''}
          </Text>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            {r.completed} of {r.total} completed{r.skipped ? `, ${r.skipped} skipped` : ''}
            {r.nextStop ? ` · ${r.nextStop.status === 'arrived' ? 'On site at' : 'Next:'} ${r.nextStop.propertyName}` : r.total ? ' · All stops done' : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sectionTitle: { marginBottom: spacing.sm },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 44 },
  stormHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  routeRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md, paddingTop: spacing.md },
  routeTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
