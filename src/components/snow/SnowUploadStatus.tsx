/**
 * The small status under a Snow "add photos" button: each photo or video that is still going up (what it is doing, and the last reason if it
 * is retrying) with Remove, and each one that failed (why) with Retry and Remove. Nothing here blocks the screen.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { mediaQueue } from '@/lib/mediaQueueRuntime';
import type { MediaJob } from '@/lib/mediaQueue';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

const NOUN = (j: MediaJob) => (j.kind === 'video' ? 'Video' : 'Photo');
function stageWord(j: MediaJob): string {
  if (j.attempts > 0 && j.error) return `Trying again (${j.attempts} of 4): ${j.error}`;
  if (j.status === 'preparing') return 'Getting ready…';
  return j.stage === 'record' ? 'Saving…' : 'Uploading…';
}

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
      {uploading.map((j) => (
        <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={[typeScale.caption, { color: j.attempts > 0 ? colors.warning : colors.textSecondary, flex: 1 }]} numberOfLines={3}>{NOUN(j)}: {stageWord(j)}</Text>
          <Pressable onPress={() => { void mediaQueue.cancel(j.id); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove this ${NOUN(j).toLowerCase()}`}>
            <Text style={[typeScale.labelLarge, { color: colors.textSecondary }]}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {failed.map((j) => (
        <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={[typeScale.caption, { color: colors.warning, flex: 1 }]} numberOfLines={4}>{NOUN(j)} didn't upload{j.error ? `: ${j.error}` : '.'}</Text>
          <Pressable onPress={() => mediaQueue.retry(j.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry the upload">
            <Text style={[typeScale.labelLarge, { color: colors.primary }]}>Retry</Text>
          </Pressable>
          <Pressable onPress={() => { void mediaQueue.cancel(j.id); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove this ${NOUN(j).toLowerCase()}`}>
            <Text style={[typeScale.labelLarge, { color: colors.textSecondary }]}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
