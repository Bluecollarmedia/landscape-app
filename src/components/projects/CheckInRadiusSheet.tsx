import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder, Platform, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { RadiusMap } from '@/components/maps/RadiusMap';
import { CHECKIN_RADIUS_STOPS_FT, feetToMeters, nearestRadiusStop, describeRadius, formatDistance, type Place } from '@/lib/maps';
import { haptics } from '@/lib/haptics';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface CheckInRadiusSheetProps {
  visible: boolean;
  place: Place;
  radiusMeters: number;
  onClose: () => void;
  onSave: (meters: number) => void;
}

const LAST = CHECKIN_RADIUS_STOPS_FT.length - 1;
const THUMB = 28;

/** "500" + "ft", or "¼" + "mi" — the big number and its unit, shown separately. */
function splitDistance(meters: number): [string, string] {
  const label = formatDistance(meters);
  const at = label.lastIndexOf(' ');
  return [label.slice(0, at), label.slice(at + 1)];
}

/**
 * Bottom sheet for a project's check-in distance: a map with the zone drawn on
 * it, and a slider that snaps through CHECKIN_RADIUS_STOPS_FT.
 */
export function CheckInRadiusSheet({ visible, place, radiusMeters, onClose, onSave }: CheckInRadiusSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(() => nearestRadiusStop(radiusMeters));
  const [trackWidth, setTrackWidth] = useState(0);

  // Start from the saved distance each time the sheet opens.
  useEffect(() => {
    if (visible) setIndex(nearestRadiusStop(radiusMeters));
  }, [visible, radiusMeters]);

  const feet = CHECKIN_RADIUS_STOPS_FT[index];
  const meters = feetToMeters(feet);
  const [value, unit] = splitDistance(meters);

  // PanResponder callbacks are created once, so read the latest values through refs.
  const live = useRef({ trackWidth, index });
  live.current = { trackWidth, index };
  const startX = useRef(0);

  function moveTo(x: number) {
    const w = live.current.trackWidth;
    if (!w) return;
    const next = Math.max(0, Math.min(LAST, Math.round((x / w) * LAST)));
    if (next !== live.current.index) {
      live.current.index = next;
      setIndex(next);
      haptics.select();
    }
  }

  // In a browser, pressing the slider moves focus off the sheet, and losing focus cancels
  // the drag. Stopping the mousedown default keeps focus where it is.
  const sliderRef = useCallback((node: View | null) => {
    if (Platform.OS !== 'web' || !node) return;
    (node as unknown as HTMLElement).addEventListener('mousedown', (e) => e.preventDefault());
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX - THUMB / 2;
        moveTo(startX.current);
      },
      onPanResponderMove: (_, g) => moveTo(startX.current + g.dx),
    }),
  ).current;

  const thumbLeft = trackWidth ? (index / LAST) * trackWidth : 0;

  return (
    <BottomSheetModal visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />
          <View style={styles.header}>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>Check-in distance</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, fontWeight: '600' }]}>Cancel</Text>
            </Pressable>
          </View>

          <RadiusMap place={place} radiusMeters={meters} fraction={index / LAST} height={190} style={styles.map} />

          <View style={styles.readout}>
            <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[typeScale.bodyLarge, { color: colors.textSecondary, fontWeight: '700', marginLeft: spacing.xs }]}>{unit}</Text>
          </View>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{describeRadius(feet)}</Text>

          {/* Slider. The outer view is the touch area; positions are measured on the inner track. */}
          <View ref={sliderRef} style={styles.sliderTouch} {...pan.panHandlers}>
            <View
              style={[styles.track, { backgroundColor: colors.borderLight }]}
              onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
              pointerEvents="none"
            >
              <View style={[styles.trackFill, { width: thumbLeft, backgroundColor: colors.primary }]} />
              {CHECKIN_RADIUS_STOPS_FT.map((ft, i) => (
                <View
                  key={ft}
                  style={[styles.tick, { left: (i / LAST) * trackWidth - 2, backgroundColor: i <= index ? '#FFFFFF' : colors.textTertiary }]}
                />
              ))}
              <View style={[styles.thumb, { left: thumbLeft - THUMB / 2, backgroundColor: '#FFFFFF', borderColor: colors.primary }]} />
            </View>
          </View>
          <View style={styles.ends}>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{formatDistance(feetToMeters(CHECKIN_RADIUS_STOPS_FT[0]))}</Text>
            <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{formatDistance(feetToMeters(CHECKIN_RADIUS_STOPS_FT[LAST]))}</Text>
          </View>

          <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
            Workers can only tap I'm here inside the circle.
          </Text>

          <Pressable
            onPress={() => { haptics.success(); onSave(meters); }}
            style={({ pressed }) => [styles.save, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[typeScale.labelLarge, { color: '#FFFFFF' }]}>Save distance</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  map: { borderRadius: radius.lg, overflow: 'hidden' },
  readout: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.lg },
  value: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  sliderTouch: { paddingVertical: spacing.lg, paddingHorizontal: THUMB / 2, marginHorizontal: -THUMB / 2, marginTop: spacing.xs },
  track: { height: 6, borderRadius: 3, justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  tick: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3 },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.sm },
  save: { height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
});
