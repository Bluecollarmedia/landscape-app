import React, { useEffect, useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useTheme } from '@/providers/ThemeProvider';
import { Icon } from '@/components/ui/Icon';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface Ended { id: string; name: string; endedAt: string }

/**
 * A storm ends by itself when its last stop is finished or skipped (update 93), so this tells the owner it happened: storms that ended in the
 * last 24 hours, with a tap through to the storm (where Reopen is, for a late stop or a second pass).
 */
export function EndedStormNote() {
  const { colors } = useTheme();
  const router = useRouter();
  const [ended, setEnded] = useState<Ended[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    supabase.from('snow_storms').select('id, name, ended_at').eq('status', 'ended').gte('ended_at', since).order('ended_at', { ascending: false }).limit(3)
      .then(({ data }) => { if (alive && data) setEnded(data.map((d) => ({ id: d.id as string, name: d.name as string, endedAt: d.ended_at as string }))); });
    return () => { alive = false; };
  }, []);

  if (!ended.length) return null;
  return (
    <>
      {ended.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => router.push({ pathname: '/snow/owner/storm/[id]', params: { id: s.id } } as any)}
          accessibilityRole="button"
          style={[styles.note, { backgroundColor: colors.primarySurface }]}
        >
          <Icon name="check-circle" size={18} color={colors.primaryDark} />
          <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1 }]}>
            {s.name} ended {new Date(s.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}: every stop was done. Tap to open it (you can reopen it for a late stop).
          </Text>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, marginTop: spacing.md },
});
