/**
 * The suggestion list under a street-address field. Give it the text the owner has typed; when they tap a suggestion it
 * hands back the whole address (street, city, state, ZIP and the exact map spot), so nothing else has to be typed.
 * Renders nothing when address suggestions are not set up (no Google key), so any form can include it safely.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { fetchPlace, fetchSuggestions, newSessionToken, placesEnabled, type PickedPlace, type Suggestion } from '@/lib/placesAutocomplete';

export function StreetSuggestions({ text, onPick }: { text: string; onPick: (place: PickedPlace) => void }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Suggestion[]>([]);
  const token = useRef(newSessionToken());
  // After a pick the field text changes by itself; do not immediately suggest again for it.
  const picked = useRef<string | null>(null);

  useEffect(() => {
    if (!placesEnabled) return;
    if (picked.current !== null && picked.current === text) { setRows([]); return; }
    picked.current = null;
    const ctl = new AbortController();
    // Wait for a pause in typing, so a few letters are one lookup, not five.
    const t = setTimeout(async () => {
      const found = await fetchSuggestions(text, token.current, ctl.signal);
      if (!ctl.signal.aborted) setRows(found);
    }, 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text]);

  if (!placesEnabled || rows.length === 0) return null;

  async function choose(s: Suggestion) {
    setRows([]);
    const place = await fetchPlace(s.placeId, token.current);
    token.current = newSessionToken();
    if (!place) return;
    picked.current = place.address;
    onPick(place);
  }

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {rows.map((s, i) => (
        <Pressable
          key={s.placeId}
          onPress={() => choose(s)}
          style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
          accessibilityRole="button"
          accessibilityLabel={`Use ${s.main}, ${s.secondary}`}
        >
          <Icon name="map-pin" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>{s.main}</Text>
            {s.secondary ? <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{s.secondary}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginTop: -spacing.sm, marginBottom: spacing.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 48 },
});
