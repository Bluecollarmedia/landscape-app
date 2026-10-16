/**
 * Snow Mode Dashboard (Owner): storms in progress with their progress, and
 * what needs attention (skip requests, photos to review, who's clocked in).
 * Working layout in the existing app style; no approved mockup yet.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, InlineNotice, LoadingSpinner, ProgressBar } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SERVICE_LABEL } from '@/data/snowStorms';
import type { SnowService } from '@/types/snow';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface ActiveStorm { id: string; name: string; service: SnowService; total: number; done: number; skipped: number }
interface Attention { skips: number; photos: number; clockedIn: number; drafts: number }

async function count(q: PromiseLike<{ count: number | null }>) {
  return (await q).count ?? 0;
}

export function SnowDashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const [storms, setStorms] = useState<ActiveStorm[]>([]);
  const [attn, setAttn] = useState<Attention>({ skips: 0, photos: 0, clockedIn: 0, drafts: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return setError('The snow dashboard needs the live database.'); }
    const { data, error: e } = await supabase.from('snow_storms').select('id, name, service')
      .eq('status', 'dispatched').order('dispatched_at', { ascending: false });
    if (e) { setLoading(false); return setError('Couldn\'t load storms.'); }
    const ids = (data ?? []).map((s) => s.id);
    const [visits, skips, photos, clockedIn, drafts] = await Promise.all([
      ids.length ? supabase.from('snow_visits').select('storm_id, status').in('storm_id', ids) : Promise.resolve({ data: [] as { storm_id: string; status: string }[] }),
      count(supabase.from('snow_skip_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      count(supabase.from('snow_completion_media').select('id', { count: 'exact', head: true }).eq('review_status', 'pending')),
      count(supabase.from('snow_shifts').select('id', { count: 'exact', head: true }).is('clock_out_at', null)),
      count(supabase.from('snow_storms').select('id', { count: 'exact', head: true }).eq('status', 'draft')),
    ]);
    const v = (visits.data ?? []) as { storm_id: string; status: string }[];
    setStorms((data ?? []).map((s) => {
      const mine = v.filter((x) => x.storm_id === s.id);
      return {
        id: s.id, name: s.name, service: s.service,
        total: mine.length,
        done: mine.filter((x) => x.status === 'completed').length,
        skipped: mine.filter((x) => x.status === 'skipped').length,
      };
    }));
    setAttn({ skips, photos, clockedIn, drafts });
    setError(null);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const openStorm = (id: string) => router.push({ pathname: '/snow/owner/storm/[id]', params: { id } });

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance + spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      >
        <View style={styles.modeChip}>
          <Icon name="cloud-snow" size={13} color={colors.primary} />
          <Text style={[typeScale.labelSmall, { color: colors.primary }]}>Snow Mode</Text>
        </View>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Dashboard</Text>
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginTop: spacing.md }} /> : null}

        {loading ? <LoadingSpinner /> : (
          <>
            <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Needs attention</Text>
            <View style={styles.tiles}>
              <Tile icon="flag" label="Skip requests" value={attn.skips} warn={attn.skips > 0} onPress={() => router.push('/snow/owner/storms')} />
              <Tile icon="camera" label="Photos to review" value={attn.photos} warn={attn.photos > 0} onPress={() => router.push('/snow/owner/review')} />
              <Tile icon="clock" label="Clocked in now" value={attn.clockedIn} onPress={() => router.push('/snow/owner/hours')} />
            </View>

            <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Storms in progress</Text>
            {storms.length ? storms.map((s) => {
              const remaining = s.total - s.done - s.skipped;
              return (
                <Pressable key={s.id} onPress={() => openStorm(s.id)} accessibilityRole="button"
                  style={[styles.card, { backgroundColor: colors.surface, marginBottom: spacing.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{s.name}</Text>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                        {SERVICE_LABEL[s.service]} · {s.total ? `${s.done} done, ${remaining} to go${s.skipped ? `, ${s.skipped} skipped` : ''}` : 'No stops yet'}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                  </View>
                  {s.total ? <ProgressBar progress={Math.round((s.done / s.total) * 100)} style={{ marginTop: spacing.sm }} /> : null}
                </Pressable>
              );
            }) : (
              <View style={[styles.card, { backgroundColor: colors.surface, alignItems: 'center', gap: spacing.sm }]}>
                <Icon name="cloud-snow" size={22} color={colors.textTertiary} />
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center' }]}>
                  {attn.drafts
                    ? `No storm is dispatched. ${attn.drafts} ${attn.drafts === 1 ? 'draft is' : 'drafts are'} ready to plan.`
                    : 'No storm is dispatched right now.'}
                </Text>
                <Button title={attn.drafts ? 'Open storms' : 'New storm'} icon={attn.drafts ? 'cloud-snow' : 'plus'} size="sm"
                  onPress={() => router.push(attn.drafts ? '/snow/owner/storms' : '/snow/owner/storm-new')} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );

  function Tile({ icon, label, value, warn, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; value: number; warn?: boolean; onPress: () => void }) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}
        style={[styles.tile, { backgroundColor: colors.surface }]}>
        <Icon name={icon} size={18} color={warn ? colors.warning : colors.primary} />
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, marginTop: spacing.xs }]}>{value}</Text>
        <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={2}>{label}</Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  label: { marginLeft: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.xl },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg },
});
