import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Icon } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { mediaQueue, useMediaJob } from '@/lib/mediaQueueRuntime';
import { formatBytes } from '@/lib/mediaPlan';

/**
 * Drawn over a thumbnail that is still a local file. Says plainly where the item is, so a local preview is never mistaken for a saved
 * file: Preparing (compressing), Uploading, or Failed with Retry / Remove. Nothing is drawn once the item is saved (or has no job).
 * Shared by every screen that shows queued photos and videos.
 */
export function MediaJobOverlay({ rowId, onDiscard, localOnly }: { rowId?: string; onDiscard?: () => void; localOnly?: boolean }) {
  const job = useMediaJob(rowId);
  // A local file with no job behind it (for example the app lost its queue) must still say it is not saved.
  if (!job && localOnly) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.box, { backgroundColor: 'rgba(120,20,20,0.78)' }]}>
        <Icon name="alert-circle" size={16} color="#FFFFFF" />
        <Text style={[typeScale.caption, styles.text]}>Not saved</Text>
      </View>
    );
  }
  if (!job || job.status === 'uploaded') return null;

  if (job.status === 'failed') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.box, { backgroundColor: 'rgba(120,20,20,0.78)' }]}>
        <Icon name="alert-circle" size={16} color="#FFFFFF" />
        <Text style={[typeScale.caption, styles.text]} numberOfLines={2}>Not saved</Text>
        <View style={styles.row}>
          <Pressable onPress={() => mediaQueue.retry(job.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Retry upload" style={styles.btn}>
            <Text style={[typeScale.caption, styles.btnText]}>Retry</Text>
          </Pressable>
          {job.canUseOriginal ? (
            <Pressable onPress={() => mediaQueue.useOriginalFile(job.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Upload the original file instead" style={styles.btn}>
              <Text style={[typeScale.caption, styles.btnText]}>Original</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => { void mediaQueue.cancel(job.id); onDiscard?.(); }}
            hitSlop={6} accessibilityRole="button" accessibilityLabel="Remove" style={styles.btn}
          >
            <Icon name="x" size={12} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  const label = job.status === 'preparing' ? 'Preparing' : 'Uploading';
  return (
    <View style={[StyleSheet.absoluteFill, styles.box, { backgroundColor: 'rgba(0,0,0,0.45)' }]} accessibilityLabel={`${label}${job.bytesOut && job.bytesIn ? `, ${formatBytes(job.bytesIn)} to ${formatBytes(job.bytesOut)}` : ''}`}>
      <ActivityIndicator color="#FFFFFF" />
      <Text style={[typeScale.caption, styles.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4 },
  text: { color: '#FFFFFF', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  btn: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
});
