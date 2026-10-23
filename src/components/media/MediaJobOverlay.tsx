import React, { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import { Icon } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { mediaQueue, useMediaJob } from '@/lib/mediaQueueRuntime';
import { formatBytes } from '@/lib/mediaPlan';
import { useT } from '@/i18n';

const alertedFailures = new Set<string>();

/** Shows the real reason a photo/video could not be saved, so a failure is never just "Not saved" with no cause. */
function showWhyNotSaved(t: (s: string) => string, reason: string | undefined) {
  const msg = reason?.trim() || t('The photo could not be saved. Try again.');
  if (Platform.OS === 'web') (globalThis as { alert?: (m: string) => void }).alert?.(msg);
  else Alert.alert(t('Why it was not saved'), msg);
}

/**
 * Drawn over a thumbnail that is still a local file. Says plainly where the item is, so a local preview is never mistaken for a saved
 * file: Preparing (compressing), Uploading, or Failed with Retry / Remove. Nothing is drawn once the item is saved (or has no job).
 * Shared by every screen that shows queued photos and videos.
 */
export function MediaJobOverlay({ rowId, onDiscard, localOnly }: { rowId?: string; onDiscard?: () => void; localOnly?: boolean }) {
  const t = useT();
  const job = useMediaJob(rowId);
  // The first time a photo fails, say why straight away (once per photo), so a failure is never just a red box with no reason.
  const failedReason = job?.status === 'failed' ? (job.error ?? '') : null;
  useEffect(() => {
    if (job && failedReason !== null && !alertedFailures.has(job.id)) { alertedFailures.add(job.id); showWhyNotSaved(t, failedReason); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, failedReason]);
  // A local file with no job behind it (for example the app lost its queue) must still say it is not saved.
  if (!job && localOnly) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.box, { backgroundColor: 'rgba(120,20,20,0.78)' }]}>
        <Icon name="alert-circle" size={16} color="#FFFFFF" />
        <Text style={[typeScale.caption, styles.text]}>{t('Not saved')}</Text>
      </View>
    );
  }
  if (!job || job.status === 'uploaded') return null;

  if (job.status === 'failed') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.box, { backgroundColor: 'rgba(120,20,20,0.78)' }]}>
        <Pressable onPress={() => showWhyNotSaved(t, job.error)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('Why it was not saved')} style={{ alignItems: 'center', gap: 2 }}>
          <Icon name="alert-circle" size={16} color="#FFFFFF" />
          <Text style={[typeScale.caption, styles.text]} numberOfLines={2}>{t('Not saved')}</Text>
          <Text style={[typeScale.caption, styles.text, { fontSize: 9, opacity: 0.85 }]}>{t('Tap for why')}</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable onPress={() => mediaQueue.retry(job.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('Retry upload')} style={styles.btn}>
            <Text style={[typeScale.caption, styles.btnText]}>{t('Retry')}</Text>
          </Pressable>
          {job.canUseOriginal ? (
            <Pressable onPress={() => mediaQueue.useOriginalFile(job.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('Upload the original file instead')} style={styles.btn}>
              <Text style={[typeScale.caption, styles.btnText]}>{t('Original')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => { void mediaQueue.cancel(job.id); onDiscard?.(); }}
            hitSlop={6} accessibilityRole="button" accessibilityLabel={t('Remove')} style={styles.btn}
          >
            <Icon name="x" size={12} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  const label = job.status === 'preparing' ? t('Preparing') : t('Uploading');
  return (
    <View style={[StyleSheet.absoluteFill, styles.box, { backgroundColor: 'rgba(0,0,0,0.45)' }]} accessibilityLabel={job.bytesOut && job.bytesIn ? t('{label}, {from} to {to}', { label, from: formatBytes(job.bytesIn), to: formatBytes(job.bytesOut) }) : label}>
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
