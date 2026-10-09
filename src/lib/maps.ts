import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { formatAddress, type AddressParts } from './address';

export interface Place extends Partial<AddressParts> {
  latitude?: number;
  longitude?: number;
}

export type NavApp = 'apple_maps' | 'google_maps' | 'waze' | 'default' | string | undefined;

export type VerifyResult =
  | { status: 'found'; latitude: number; longitude: number }
  | { status: 'not_found' }
  | { status: 'unavailable'; reason: string };

/**
 * Looks the address up with the phone's own map service (Apple Maps on iPhone,
 * Google on Android). Free, no API key. Not available on the web.
 */
export async function verifyAddress(a: AddressParts): Promise<VerifyResult> {
  if (Platform.OS === 'web') return { status: 'unavailable', reason: 'Address check works in the phone app.' };
  try {
    if (Platform.OS === 'android') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return { status: 'unavailable', reason: 'Location permission is needed to check addresses.' };
    }
    const results = await Location.geocodeAsync(formatAddress(a));
    const hit = results[0];
    if (!hit) return { status: 'not_found' };
    return { status: 'found', latitude: hit.latitude, longitude: hit.longitude };
  } catch (err: any) {
    // The geocoder throws when it has no match on some platforms.
    const msg = String(err?.message ?? '');
    if (/not found|no result|kCLErrorDomain error 8|geocode/i.test(msg)) return { status: 'not_found' };
    return { status: 'unavailable', reason: msg || 'Address check failed.' };
  }
}

/** Opens turn-by-turn directions, using the exact map spot when the address was verified. */
export function openDirections(place: Place, navApp?: NavApp) {
  const label = formatAddress(place);
  const hasCoords = place.latitude != null && place.longitude != null;
  const dest = encodeURIComponent(hasCoords ? `${place.latitude},${place.longitude}` : label);
  let url: string;
  switch (navApp) {
    case 'google_maps':
      url = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
      break;
    case 'waze':
      url = hasCoords
        ? `https://waze.com/ul?ll=${dest}&navigate=yes`
        : `https://waze.com/ul?q=${dest}&navigate=yes`;
      break;
    case 'apple_maps':
      url = `https://maps.apple.com/?daddr=${dest}`;
      break;
    default:
      url = Platform.OS === 'ios'
        ? `https://maps.apple.com/?daddr=${dest}`
        : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  }
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
    return;
  }
  // https links hand off to the installed app (Google Maps, Waze, Apple
  // Maps) via universal links, or fall back to the browser if it's missing.
  Linking.openURL(url).catch(() => Alert.alert('Could not open maps', label));
}

/** Shows the spot on a map (no directions), to eyeball a verified address. */
export function previewOnMap(place: Place) {
  const label = encodeURIComponent(formatAddress(place));
  const ll = `${place.latitude},${place.longitude}`;
  const url = Platform.OS === 'ios'
    ? `https://maps.apple.com/?ll=${ll}&q=${label}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ll)}`;
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url).catch(() => {});
}
