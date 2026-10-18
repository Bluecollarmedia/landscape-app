/**
 * One maintenance stop, for the crew: where it is, what to do, the visit's
 * checklist and photos, and the fixed bottom action (I'M HERE, then FINISH
 * STOP). Everything here is the shared stop record, so a crewmate's ticks,
 * photos and finish show up for everyone.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { GlassIconButton, Icon, InlineNotice, PressableScale } from '@/components/ui';
import { StopChecklist, clockTime } from '@/components/maintenance/StopChecklist';
import { StopPhotos } from '@/components/maintenance/StopPhotos';
import { FinishStopButton } from '@/components/maintenance/FinishStopButton';
import { db, useDb } from '@/data/store';
import { markArrived, locationLabel } from '@/data/maintenance';
import { finishStopAndAdvance, missingRequirements, nextStopAfter, uploadingPhotoCount } from '@/data/maintenanceFinish';
import { getCurrentGps } from '@/lib/location';
import { openDirections } from '@/lib/maps';
import { haptics } from '@/lib/haptics';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const nameOf = (personId?: string) => {
  const p = personId ? db.people[personId] : undefined;
  return p ? `${p.firstName} ${p.lastName}`.trim() : 'A crew member';
};

export default function MaintenanceStopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const v = useDb();
  const [arriving, setArriving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = id ? db.maintenance.stopById[id] : undefined;
  const route = stop ? db.maintenance.routeById[stop.routeId] : undefined;
  const missing = useMemo(() => (stop ? missingRequirements(stop) : []), [v, stop]);
  const next = useMemo(() => (stop ? nextStopAfter(stop) : undefined), [v, stop]);

  if (!stop || !route) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <GlassIconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
        </View>
        <View style={styles.center}>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>This stop isn't on your route.</Text>
        </View>
      </View>
    );
  }

  const p = stop.property;
  const locked = stop.status === 'completed' || stop.status === 'skipped';
  const required = stop.tasks.filter((t) => t.isRequired);
  const addressLine = [p?.address, p?.city, p?.state].filter(Boolean).join(', ');

  async function handleArrive() {
    setError(null);
    setArriving(true);
    haptics.light();
    // Never blocked by GPS: whatever the phone reports (or doesn't) is recorded honestly.
    const gps = await Promise.race([getCurrentGps(), new Promise<undefined>((r) => setTimeout(() => r(undefined), 6000))]);
    const res = await markArrived(stop!.id, gps);
    setArriving(false);
    if (res.ok) haptics.success();
    else setError(res.error);
  }

  async function handleFinish() {
    setError(null);
    const res = await finishStopAndAdvance(stop!.id);
    if (res.ok) {
      haptics.success();
    } else {
      haptics.warning();
      if (res.error) setError(res.error);
    }
  }

  function goNext() {
    if (next) router.replace(`/(worker)/maintenance-stop/${next.id}`);
    else router.back();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 220 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <GlassIconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
          <Text style={[typeScale.labelLarge, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>
            Stop {stop.number} of {route.stops.length}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>{p?.name ?? 'Property'}</Text>
        {!!addressLine && (
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, marginTop: 4 }]}>{addressLine}</Text>
        )}

        {!!p && !locked && (
          <PressableScale
            onPress={() => openDirections({ ...p, latitude: p.latitude, longitude: p.longitude }, db.workerSettings.navApp)}
            accessibilityRole="button"
            accessibilityLabel="Directions"
            style={[styles.directions, { borderColor: colors.primary }]}
          >
            <Icon name="navigation" size={16} color={colors.primary} />
            <Text style={[typeScale.labelLarge, { color: colors.primary }]}>Directions</Text>
          </PressableScale>
        )}

        {/* Status */}
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {stop.status === 'completed' && stop.completedAt && (
            <InlineNotice
              icon="check-circle"
              tone="success"
              text={`Finished by ${nameOf(stop.completedBy)} at ${clockTime(stop.completedAt)} · ${locationLabel(stop.completionLocationStatus)}`}
            />
          )}
          {stop.status === 'skipped' && (
            <InlineNotice icon="slash" tone="neutral" text={`Skipped${stop.skipReason ? `: ${stop.skipReason}` : ''}`} />
          )}
          {stop.arrivedAt && (
            <InlineNotice
              icon="map-pin"
              tone={stop.arrivalLocationStatus === 'verified' ? 'success' : 'neutral'}
              text={`Arrived ${clockTime(stop.arrivedAt)} · ${nameOf(stop.arrivedBy)} · ${locationLabel(stop.arrivalLocationStatus)}`}
            />
          )}
        </View>

        {/* Services */}
        {stop.services.length > 0 && (
          <Section title="Services">
            <View style={styles.chips}>
              {stop.services.map((s) => (
                <View key={s.id} style={[styles.chip, { backgroundColor: colors.primarySurface }]}>
                  {s.completed && <Icon name="check" size={12} color={colors.primaryDark} />}
                  <Text style={[typeScale.bodySmall, { color: colors.primaryDark, fontWeight: '600' }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* This visit's instructions, then the property's standing notes */}
        {!!stop.instructions && (
          <Section title="For this visit">
            <View style={[styles.note, { backgroundColor: colors.warningLight }]}>
              <Icon name="alert-circle" size={16} color={colors.warning} />
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{stop.instructions}</Text>
            </View>
          </Section>
        )}
        {!!route.notes && (
          <Section title="Route notes">
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{route.notes}</Text>
          </Section>
        )}
        {!!p?.accessNotes && (
          <Section title="Access">
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{p.accessNotes}</Text>
          </Section>
        )}

        {stop.tasks.length > 0 && (
          <Section title={required.length ? `Checklist · ${required.filter((t) => t.completedAt).length} of ${required.length} required` : 'Checklist'}>
            <StopChecklist tasks={stop.tasks} locked={locked} onError={setError} />
          </Section>
        )}

        {(stop.requiresPhotos || stop.photos.length > 0 || !locked) && (
          <Section title="Photos">
            <StopPhotos
              stopId={stop.id}
              photos={stop.photos}
              requiresPhotos={stop.requiresPhotos}
              minPhotos={stop.minPhotos}
              locked={locked}
            />
          </Section>
        )}
      </ScrollView>

      {/* Fixed bottom action */}
      <View
        style={[styles.bottom, {
          paddingBottom: Math.max(insets.bottom, spacing.md),
          backgroundColor: colors.background,
          borderTopColor: colors.borderLight,
        }]}
      >
        {!!error && <InlineNotice icon="alert-triangle" tone="error" text={error} style={{ marginBottom: spacing.sm }} />}
        {stop.status === 'pending' && (
          <PrimaryButton
            label={arriving ? 'RECORDING…' : "I'M HERE"}
            icon="map-pin"
            busy={arriving}
            onPress={handleArrive}
          />
        )}
        {stop.status === 'arrived' && (
          <FinishStopButton stopId={stop.id} missing={missing} uploading={uploadingPhotoCount(stop)} onPress={handleFinish} />
        )}
        {locked && (
          <PrimaryButton
            label={next ? `NEXT: ${next.property?.name ?? `STOP ${next.number}`}` : 'BACK TO ROUTE'}
            icon={next ? 'arrow-right' : 'list'}
            onPress={goNext}
          />
        )}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={[typeScale.overline, { color: colors.textSecondary, marginBottom: spacing.sm }]}>{title}</Text>
      {children}
    </View>
  );
}

function PrimaryButton({ label, icon, onPress, busy }: { label: string; icon: string; onPress: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={busy} haptic={false} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={[colors.primary, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Icon name={icon as any} size={20} color="#FFFFFF" />}
        <Text numberOfLines={1} style={[typeScale.labelLarge, { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.6, flexShrink: 1 }]}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  directions: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start',
    marginTop: spacing.md, paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.full, borderWidth: 1.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full },
  note: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth,
  },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: radius.full, gap: spacing.sm, paddingHorizontal: spacing.lg },
});
