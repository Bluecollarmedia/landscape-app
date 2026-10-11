import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useTheme } from '@/providers/ThemeProvider';
import { findCoords, cachedCoords } from '@/lib/maps';
import { formatAddress } from '@/lib/address';
import { RadiusMap as DrawnRadius, type RadiusMapProps } from './RadiusMap';

type Coords = { latitude: number; longitude: number };

/** Apple Maps view of the job site with the check-in zone drawn on it, zoomed to fit the circle. */
export function RadiusMap(props: RadiusMapProps) {
  const { place, radiusMeters, height = 180, style } = props;
  const { colors } = useTheme();
  const key = formatAddress(place);
  const [coords, setCoords] = useState<Coords | null | undefined>(() => cachedCoords(place));

  useEffect(() => {
    let live = true;
    findCoords(place).then((c) => { if (live) setCoords(c); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, place.latitude, place.longitude]);

  if (!coords) return <DrawnRadius {...props} />;

  // Show about 1.4x the circle's width so its edge sits comfortably inside the map.
  const latitudeDelta = (radiusMeters * 2.8) / 111_000;

  return (
    <View style={[{ height }, style]} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        region={{ ...coords, latitudeDelta, longitudeDelta: latitudeDelta }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
      >
        <Circle
          center={coords}
          radius={radiusMeters}
          strokeColor={colors.primary}
          strokeWidth={2}
          fillColor="rgba(76, 175, 80, 0.18)"
        />
        <Marker coordinate={coords} pinColor={colors.primary} />
      </MapView>
    </View>
  );
}
