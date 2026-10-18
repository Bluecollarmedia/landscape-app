/**
 * Snow Mode Dashboard (Owner): Needs Attention and Storm Overview, kept as two
 * separate sections. Needs Attention lists each item that waits on the owner
 * and opens its record; Storm Overview shows every draft and dispatched storm
 * by route, with leads and progress. Data comes from useSnowDashboard
 * (src/data/snowDashboard.ts). Working layout in the existing app style; no
 * approved mockup yet.
 */
import { servicesLabel, stormServices } from '@/lib/snowServices';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, InlineNotice, LoadingSpinner, ProgressBar, StatusBadge } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useSnowDashboard } from '@/hooks/useSnowDashboard';
import { SERVICE_LABEL } from '@/data/snowStorms';
import { LONG_OPEN_SHIFT_HOURS, type AttentionItem, type StormOverview } from '@/data/snowDashboard';
import { snowDashboardHref } from '@/lib/snowLinks';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const ATTENTION_ICON: Record<AttentionItem['kind'], React.ComponentProps<typeof Icon>['name']> = {
  skip_request: 'flag',
  missing_media: 'camera-off',
  route_without_lead: 'user-x',
  media_review: 'camera',
  open_shift: 'clock',
};

export function SnowDashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { state, storms, needsAttention, shiftsChecked, clockedInCount, refreshing, onRefresh, reload } = useSnowDashboard();

  const header = (
    <>
      <View style={styles.modeChip}>
        <Icon name="cloud-snow" size={13} color={colors.primary} />
        <Text style={[typeScale.labelSmall, { color: colors.primary }]}>Snow Mode</Text>
      </View>
      <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Dashboard</Text>
    </>
  );

  const contentStyle = { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance + spacing.lg };

  if (state.kind === 'loading' || state.kind === 'unavailable') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
        <View style={contentStyle}>
          {header}
          {state.kind === 'loading'
            ? <LoadingSpinner />
            : <EmptyState icon="cloud-snow" title="Snow data isn't available" description={state.reason} />}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={contentStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {header}
        {state.kind === 'error' && (
          <Pressable onPress={reload} accessibilityRole="button" accessibilityLabel="Couldn't refresh. Tap to try again">
            <InlineNotice icon="alert-circle" tone="error" text={`Couldn't refresh: ${state.message}. Tap to try again.`} style={{ marginTop: spacing.md }} />
          </Pressable>
        )}

        <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>
          Needs attention{needsAttention.length ? ` (${needsAttention.length})` : ''}
        </Text>
        {!shiftsChecked && (
          <InlineNotice
            icon="clock"
            tone="neutral"
            text="Time records aren't checked: snow clock in and out isn't set up on this database yet."
            style={{ marginBottom: spacing.sm }}
          />
        )}
        {needsAttention.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>Nothing is waiting on you.</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, paddingVertical: 0 }]}>
            {needsAttention.map((item, i) => (
              <Pressable
                key={item.key}
                onPress={() => router.push(snowDashboardHref(item.target))}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.detail}`}
              >
                <Icon name={ATTENTION_ICON[item.kind]} size={18} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{item.title}</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{item.detail}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        )}
        {shiftsChecked && (
          <Pressable onPress={() => router.push('/snow/owner/hours')} accessibilityRole="button" style={styles.clockedIn}>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
              {clockedInCount} clocked in now · shifts open over {LONG_OPEN_SHIFT_HOURS} hours are listed above
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textTertiary} />
          </Pressable>
        )}

        <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Storm overview</Text>
        {storms.length ? storms.map((s) => (
          <StormCard key={s.id} storm={s} onOpenStorm={() => router.push(snowDashboardHref({ kind: 'storm', stormId: s.id }))}
            onOpenRoute={(routeId) => router.push(snowDashboardHref({ kind: 'route', stormId: s.id, routeId }))} />
        )) : (
          <View style={[styles.card, { backgroundColor: colors.surface, alignItems: 'center', gap: spacing.sm }]}>
            <Icon name="cloud-snow" size={22} color={colors.textTertiary} />
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center' }]}>No storm is planned or dispatched right now.</Text>
            <Button title="New storm" icon="plus" size="sm" onPress={() => router.push('/snow/owner/storm-new')} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StormCard({ storm, onOpenStorm, onOpenRoute }: { storm: StormOverview; onOpenStorm: () => void; onOpenRoute: (routeId: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: spacing.md }]}>
      <Pressable onPress={onOpenStorm} accessibilityRole="button" accessibilityLabel={`Open ${storm.name}`} style={styles.stormHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{storm.name}</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
            {servicesLabel(stormServices(storm), (x) => SERVICE_LABEL[x])}
            {storm.reopenedCount > 0 ? ` · Reopened${storm.reopenedCount > 1 ? ` ${storm.reopenedCount}×` : ''}` : ''}
          </Text>
        </View>
        <StatusBadge label={storm.status === 'draft' ? 'Not dispatched' : 'Dispatched'} status={storm.status === 'draft' ? 'neutral' : 'info'} />
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>

      <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
        {storm.total
          ? `${storm.completed} completed, ${storm.remaining} remaining${storm.skipped ? `, ${storm.skipped} skipped` : ''} of ${storm.total} stops`
          : 'No stops yet'}
        {storm.attentionCount ? ` · ${storm.attentionCount} need${storm.attentionCount === 1 ? 's' : ''} attention` : ''}
      </Text>
      {storm.total ? <ProgressBar progress={Math.round(storm.progress * 100)} style={{ marginTop: spacing.xs }} /> : null}

      {storm.routes.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => onOpenRoute(r.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open route ${r.name}`}
          style={({ pressed }) => [styles.routeRow, { borderTopColor: colors.separator }, pressed && { opacity: 0.6 }]}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.routeTitle}>
              <Text style={[typeScale.bodyLarge, { color: r.cancelled ? colors.textTertiary : colors.textPrimary, fontWeight: '600', flex: 1 }]}>
                {r.name}{r.cancelled ? ' (cancelled)' : ''}
              </Text>
              {r.attentionCount > 0 && <StatusBadge label={`${r.attentionCount} need${r.attentionCount === 1 ? 's' : ''} attention`} status="warning" />}
            </View>
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              Lead: {r.leadName ?? 'Not assigned'}
              {r.mediaRequired ? ` · ${r.minMedia} photo${r.minMedia === 1 ? '' : 's'} required` : ''}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {r.completed} of {r.total} completed{r.skipped ? `, ${r.skipped} skipped` : ''}
              {r.nextStop ? ` · ${r.nextStop.status === 'arrived' ? 'On site at' : 'Next:'} ${r.nextStop.propertyName}` : r.total ? ' · All stops done' : ''}
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.textTertiary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  label: { marginLeft: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.xl },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 44 },
  clockedIn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, marginLeft: spacing.sm, minHeight: 32 },
  stormHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md, paddingTop: spacing.md, minHeight: 44 },
  routeTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
