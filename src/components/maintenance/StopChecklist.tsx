/**
 * The checklist for one maintenance visit. Any crew member can tick an item;
 * the tick is shared with the whole crew and records who ticked it.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon, PressableScale } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { db } from '@/data/store';
import { setTaskDone } from '@/data/maintenance';
import { askForTaskPhoto } from '@/lib/stopPhotoPicker';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';
import type { MaintenanceStopTask } from '@/types/maintenance';

interface Props {
  tasks: MaintenanceStopTask[];
  /** Finished or skipped stops show the list read-only. */
  locked: boolean;
  /** Ticking a task offers a photo when the stop has none yet; when the property requires photos it must be added first. */
  stopId: string;
  requiresPhotos: boolean;
  photoCount: number;
  onError?: (message: string) => void;
}

export function StopChecklist({ tasks, locked, stopId, requiresPhotos, photoCount, onError }: Props) {
  const { colors } = useTheme();
  const [saving, setSaving] = useState<string | null>(null);
  const sorted = tasks.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  async function toggle(t: MaintenanceStopTask) {
    if (locked || saving) return;
    haptics.light();
    if (!t.completedAt && photoCount === 0) {
      setSaving(t.id);
      const go = await askForTaskPhoto(stopId, requiresPhotos);
      setSaving(null);
      if (!go) return;
    }
    setSaving(t.id);
    const res = await setTaskDone(t.id, !t.completedAt);
    setSaving(null);
    if (!res.ok) onError?.(res.error);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      {sorted.map((t, i) => {
        const done = !!t.completedAt;
        const by = t.completedBy ? db.people[t.completedBy] : undefined;
        return (
          <PressableScale
            key={t.id}
            onPress={() => toggle(t)}
            disabled={locked}
            haptic={false}
            scaleTo={0.98}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done, disabled: locked }}
            accessibilityLabel={t.title}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
          >
            <View style={[styles.box, done
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { borderColor: colors.border }]}
            >
              {saving === t.id
                ? <ActivityIndicator size="small" color={done ? '#FFFFFF' : colors.primary} />
                : done && <Icon name="check" size={16} color="#FFFFFF" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }, done && { color: colors.textSecondary }]}>
                {t.title}
              </Text>
              {done ? (
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                  {by ? `${by.firstName} · ` : ''}{clockTime(t.completedAt!)}
                </Text>
              ) : !t.isRequired ? (
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>Optional</Text>
              ) : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
