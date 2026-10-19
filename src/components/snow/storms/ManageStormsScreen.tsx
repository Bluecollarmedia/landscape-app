/**
 * Snow settings -> Manage storms (Owner). Every storm, whatever its status, newest first, each with a small Delete
 * button. A storm can always be deleted from here: one made by mistake, or one that is finished and unwanted.
 * Deleting asks first, with the real counts, and is permanent (update 50). Kept off the dashboard on purpose.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, GlassIconButton, Icon, InlineNotice, LoadingSpinner } from '@/components/ui';
import { SnowPill } from '@/components/snow/SnowPill';
import { confirmAction, showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { deleteStormForGood, loadStormCounts, loadStorms, SERVICE_LABEL, STORM_STATUS_LABEL } from '@/data/snowStorms';
import { deleteConfirmation } from '@/lib/snowStormDelete';
import { servicesLabel, stormServices } from '@/lib/snowServices';
import { longWhen } from '@/lib/snowStormView';
import { snowStatus } from '@/theme/colors';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { SnowStorm } from '@/types/snow';

const PILL = { draft: snowStatus.scheduled, dispatched: snowStatus.dispatched, ended: snowStatus.completed } as const;

export function ManageStormsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [storms, setStorms] = useState<SnowStorm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await loadStorms();
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setStorms(res.data);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function onDelete(s: SnowStorm) {
    setBusyId(s.id);
    // Fresh numbers for the question, not whatever was on screen.
    const counts = await loadStormCounts(s.id);
    setBusyId(null);
    if (!counts.ok) return showMessage('Couldn\'t check the storm', counts.error);
    const c = deleteConfirmation(s.name, s.status, counts.data);
    confirmAction(c.title, c.message, c.confirm, async () => {
      setBusyId(s.id);
      const res = await deleteStormForGood(s.id, s.status);
      setBusyId(null);
      if (!res.ok) return showMessage('Couldn\'t delete the storm', res.error);
      setDone(`Deleted ${s.name}.`);
      reload();
    }, true);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}
      >
        <GlassIconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>Manage storms</Text>
        <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg }]}>
          Delete a storm for good, whatever its status. You can't undo it.
        </Text>
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}
        {done ? <InlineNotice icon="check-circle" tone="success" text={done} style={{ marginBottom: spacing.md }} /> : null}
        {loading ? (
          <LoadingSpinner />
        ) : storms.length === 0 ? (
          <EmptyState icon="cloud-snow" title="No storms" description="Storms you create show up here." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {storms.map((s) => {
              const tone = PILL[s.status];
              const when = s.status === 'ended' && s.endedAt ? `Ended ${longWhen(s.endedAt)}` : s.dispatchedAt ? `Dispatched ${longWhen(s.dispatchedAt)}` : `Created ${longWhen(s.createdAt)}`;
              return (
                <View key={s.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{s.name}</Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                      {servicesLabel(stormServices(s), (x) => SERVICE_LABEL[x])} {'·'} {when}
                    </Text>
                    <SnowPill label={STORM_STATUS_LABEL[s.status]} fg={tone.fg} bg={tone.bg} />
                  </View>
                  <Pressable
                    onPress={() => onDelete(s)}
                    disabled={busyId !== null}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${s.name}`}
                    style={({ pressed }) => [styles.delete, { backgroundColor: colors.errorLight }, (pressed || busyId === s.id) && { opacity: 0.6 }]}
                  >
                    <Icon name="trash-2" size={18} color={colors.error} />
                    <Text style={[typeScale.labelLarge, { color: colors.error }]}>Delete</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.full },
});
