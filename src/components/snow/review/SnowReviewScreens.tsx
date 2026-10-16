/**
 * Snow media review (Owner) and Snow updates (Customer), update 030.
 * Owner: approve or hide each photo/video of a completed stop, then send the
 * stop to the customer. Customer: completed stops at their properties with
 * the photos the owner sent. Working layout in the existing app style; no
 * approved mockup yet.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, InlineNotice, LoadingSpinner, ScreenHeader, StatusBadge } from '@/components/ui';
import { showMessage } from '@/components/financials/ActionSheet';
import { pickSnowMedia } from '@/components/snow/pickSnowMedia';
import { db, useDb } from '@/data/store';
import { useTheme } from '@/providers/ThemeProvider';
import { SERVICE_LABEL } from '@/data/snowStorms';
import {
  addOwnerMedia, loadCustomerSnowUpdates, loadReviewQueue, reviewMedia, sendCustomerUpdate,
  type CustomerSnowUpdate, type ReviewMedia, type ReviewStop,
} from '@/data/snowMediaReview';
import { CustomerNotifyPrefs } from '@/components/snow/notifications/SnowNotifySettings';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Thumb({ m, children }: { m: { kind: string; url?: string }; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.thumb, { backgroundColor: colors.borderLight }]}>
      {m.url && m.kind === 'photo' ? <Image source={{ uri: m.url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
        <View style={styles.thumbIcon}><Icon name={m.kind === 'video' ? 'video' : 'image'} size={22} color={colors.textTertiary} /></View>
      )}
      {children}
    </View>
  );
}

/** Owner: Snow More → Photo review. */
export function SnowMediaReviewScreen() {
  useDb();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [stops, setStops] = useState<ReviewStop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await loadReviewQueue();
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setStops(res.data);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function review(m: ReviewMedia, status: 'approved' | 'hidden') {
    setBusy(m.id);
    const res = await reviewMedia(m.id, status);
    setBusy(null);
    if (!res.ok) showMessage('Couldn\'t save', res.error);
    reload();
  }

  async function send(s: ReviewStop) {
    setBusy(s.visitId);
    const res = await sendCustomerUpdate(s.visitId);
    setBusy(null);
    if (!res.ok) return showMessage('Couldn\'t send', res.error);
    showMessage('Sent to the customer', res.data
      ? `${res.data} ${res.data === 1 ? 'photo is' : 'photos are'} now in their Snow updates.`
      : 'The stop is now in their Snow updates.');
    reload();
  }

  async function addPhotos(s: ReviewStop) {
    if (!db.companyId) return;
    const drafts = await pickSnowMedia();
    if (!drafts.length) return;
    setBusy(s.visitId);
    const res = await addOwnerMedia(db.companyId, s.visitId, drafts);
    setBusy(null);
    if (!res.ok) showMessage("Couldn't add the photo", res.error);
    reload();
  }

  const waiting = stops.filter((s) => !s.notified);
  const sent = stops.filter((s) => s.notified);

  function StopCard({ s }: { s: ReviewStop }) {
    const pending = s.media.some((m) => m.status === 'pending');
    const newlyApproved = s.media.some((m) => m.status === 'approved' && !m.shared);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: spacing.md, gap: spacing.sm }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{s.propertyName}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{SERVICE_LABEL[s.service]} · {when(s.completedAt)}</Text>
          </View>
          {s.notified ? <StatusBadge label="Sent" status="success" /> : null}
        </View>
        {s.completionNote ? <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>“{s.completionNote}”</Text> : null}
        {s.media.length ? (
          <View style={styles.thumbs}>
            {s.media.map((m) => (
              <View key={m.id} style={{ gap: 4, opacity: m.status === 'hidden' ? 0.4 : 1 }}>
                <Thumb m={m} />
                {m.shared ? (
                  <Text style={[typeScale.caption, { color: colors.success, textAlign: 'center' }]}>Sent</Text>
                ) : (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
                    <Pressable disabled={busy === m.id} onPress={() => review(m, 'approved')} hitSlop={6} accessibilityLabel="Approve">
                      <Icon name="check-circle" size={22} color={m.status === 'approved' ? colors.success : colors.textTertiary} />
                    </Pressable>
                    <Pressable disabled={busy === m.id} onPress={() => review(m, 'hidden')} hitSlop={6} accessibilityLabel="Hide">
                      <Icon name="eye-off" size={22} color={m.status === 'hidden' ? colors.error : colors.textTertiary} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typeScale.caption, { color: colors.textTertiary }]}>No photos for this stop.</Text>
        )}
        <Button
          title="Add a photo or video"
          icon="camera"
          size="sm"
          variant="secondary"
          disabled={busy === s.visitId}
          onPress={() => addPhotos(s)}
        />
        {!s.notified || newlyApproved ? (
          <Button
            title={s.notified ? 'Share newly approved photos' : 'Send to customer'}
            icon="send"
            size="sm"
            disabled={pending}
            loading={busy === s.visitId}
            onPress={() => send(s)}
          />
        ) : null}
        {pending ? <Text style={[typeScale.caption, { color: colors.warning }]}>Approve or hide every photo before sending.</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title="Photo review" subtitle="Completed stops, last 14 days" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      >
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}
        {loading ? <LoadingSpinner /> : !stops.length ? (
          <EmptyState icon="camera" title="Nothing to review" description="Completed stops and their photos show up here." />
        ) : (
          <>
            {waiting.length ? <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>To send</Text> : null}
            {waiting.map((s) => <StopCard key={s.visitId} s={s} />)}
            {sent.length ? <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Sent</Text> : null}
            {sent.map((s) => <StopCard key={s.visitId} s={s} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Customer: Account → Snow updates. */
export function CustomerSnowUpdatesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [updates, setUpdates] = useState<CustomerSnowUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await loadCustomerSnowUpdates();
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setUpdates(res.data);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title="Snow updates" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      >
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginBottom: spacing.md }} /> : null}
        {loading ? <LoadingSpinner /> : !updates.length ? (
          <EmptyState icon="cloud-snow" title="No snow updates yet" description="When your property is plowed, shoveled or salted, you'll see it here with photos." />
        ) : updates.map((u) => (
          <View key={u.visitId} style={[styles.card, { backgroundColor: colors.surface, marginBottom: spacing.md, gap: spacing.sm }]}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{SERVICE_LABEL[u.service]} done</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{u.propertyName} · {when(u.completedAt)}</Text>
            {u.media.length ? <View style={styles.thumbs}>{u.media.map((m) => <Thumb key={m.id} m={m} />)}</View> : null}
          </View>
        ))}
        <CustomerNotifyPrefs />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  label: { marginLeft: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.md },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 88, height: 88, borderRadius: radius.md, overflow: 'hidden' },
  thumbIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
