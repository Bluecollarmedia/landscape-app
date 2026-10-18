/**
 * Customer: Maintenance updates. Finished visits to their property, newest
 * first, with the services done and only the photos the owner shared.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, InlineNotice, LoadingSpinner, OptimizedImage, ScreenHeader } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { loadCustomerMaintenanceUpdates, type CustomerMaintenanceUpdate } from '@/data/maintenanceCustomer';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function CustomerMaintenanceUpdatesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [updates, setUpdates] = useState<CustomerMaintenanceUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await loadCustomerMaintenanceUpdates();
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setUpdates(res.data);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title="Maintenance updates" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      >
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}
        {loading ? <LoadingSpinner /> : !updates.length ? (
          <EmptyState icon="repeat" title="No maintenance visits yet" description="After each visit to your property you'll see it here, with photos when we've shared them." />
        ) : updates.map((u) => (
          <View key={u.stopId} style={[styles.card, { backgroundColor: colors.surface, marginBottom: spacing.md, gap: spacing.sm }]}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{u.services || 'Maintenance visit'}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{u.propertyName} · {when(u.completedAt)}</Text>
            {u.photos.length ? (
              <View style={styles.thumbs}>
                {u.photos.map((p) => (
                  <OptimizedImage key={p.id} source={p.url} style={styles.thumb} accessibilityLabel="Photo from your visit" />
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden' },
});
