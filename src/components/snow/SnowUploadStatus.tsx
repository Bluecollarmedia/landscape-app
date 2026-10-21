/**
 * The small status under a Snow "add photos" button: how many are uploading in the background, and for each one that failed, why, with
 * Retry and Remove. Nothing here blocks the screen; the person can keep working while photos upload.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { mediaQueue } from '@/lib/mediaQueueRuntime';
import type { MediaJob } from '@/lib/mediaQueue';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export function SnowUploadStatus({ uploading, failed }: { uploading: MediaJob[]; failed: MediaJob[] }) {
  const { colors } = useTheme();
  if (!uploading.length && !failed.length) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      {uploading.length ? (
        <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
          {uploading.length === 1 ? '1 photo is' : `${uploading.length} photos are`} uploading in the background. You can keep going.
        </Text>
      ) : null}
      {failed.map((j) => (
        <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={[typeScale.caption, { color: colors.warning, flex: 1 }]} numberOfLines={2}>A photo didn't upload{j.error ? `: ${j.error}` : '.'}</Text>
          <Pressable onPress={() => mediaQueue.retry(j.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry the photo upload">
            <Text style={[typeScale.labelLarge, { color: colors.primary }]}>Retry</Text>
          </Pressable>
          <Pressable onPress={() => { void mediaQueue.cancel(j.id); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove the photo">
            <Text style={[typeScale.labelLarge, { color: colors.textSecondary }]}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
