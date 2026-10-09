import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '@/providers/ThemeProvider';
import { verifyAddress } from '@/lib/maps';
import { formatAddress } from '@/lib/address';
import { JobMap as PinCard, type JobMapProps } from './JobMap';

type Coords = { latitude: number; longitude: number };

/** Addresses already looked up this session, so the map doesn't re-geocode on every render. */
const geocodeCache = new Map<string, Coords | null>();

/** Apple Maps preview of the job site. Taps fall through to the parent (which opens directions). */
export function JobMap(props: JobMapProps) {
  const { place, height = 140, style } = props;
  const { colors } = useTheme();
  const key = formatAddress(place);
  const saved = place.latitude != null && place.longitude != null
    ? { latitude: place.latitude, longitude: place.longitude }
    : undefined;
  const [coords, setCoords] = useState<Coords | null | undefined>(saved ?? geocodeCache.get(key));

  useEffect(() => {
    if (saved) { setCoords(saved); return; }
    if (!key) { setCoords(null); return; }
    if (geocodeCache.has(key)) { setCoords(geocodeCache.get(key)); return; }
    let live = true;
    verifyAddress({ address: place.address ?? '', city: place.city ?? '', state: place.state ?? '', zip: place.zip ?? '' })
      .then((r) => {
        const c = r.status === 'found' ? { latitude: r.latitude, longitude: r.longitude } : null;
        geocodeCache.set(key, c);
        if (live) setCoords(c);
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, saved?.latitude, saved?.longitude]);

  if (!coords) return <PinCard {...props} />;

  return (
    <View style={[{ height }, style]} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        region={{ ...coords, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
      >
        <Marker coordinate={coords} pinColor={colors.primary} />
      </MapView>
    </View>
  );
}
