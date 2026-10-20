/**
 * Picking reference photos/videos for a snow property service. Same camera /
 * library choice and limits as task media (60-second videos, 50 MB per file).
 */
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { formatBytes } from '@/types/storage';
import type { SnowMediaDraft } from '@/data/snowProperties';

export const MAX_SNOW_VIDEO_SECONDS = 60;
export const MAX_SNOW_FILE_BYTES = 50 * 1024 * 1024;
/** Most files one pick can add (more can be added afterwards). */
const MAX_PER_PICK = 10;

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') (globalThis as { alert?: (m: string) => void }).alert?.(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function chooseSource(): Promise<'camera' | 'library' | null> {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise((resolve) => {
    Alert.alert('Add reference photo or video', undefined, [
      { text: 'Take Photo or Video', onPress: () => resolve('camera') },
      { text: 'Choose from Library', onPress: () => resolve('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

export async function pickSnowMedia(): Promise<SnowMediaDraft[]> {
  const source = await chooseSource();
  if (!source) return [];

  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    notify(
      source === 'camera' ? 'Camera access is off' : 'Photo access is off',
      'Turn it on for Brighton Lawn in the Settings app to add reference photos and videos.',
    );
    return [];
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    quality: 1,
    videoMaxDuration: MAX_SNOW_VIDEO_SECONDS,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    allowsMultipleSelection: source === 'library',
    selectionLimit: MAX_PER_PICK,
  };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return [];

  const drafts: SnowMediaDraft[] = [];
  const skipped: string[] = [];
  for (const asset of result.assets.slice(0, MAX_PER_PICK)) {
    const mediaType = asset.type === 'video' ? 'video' : 'image';
    const sizeBytes = asset.fileSize ?? (asset as { file?: File }).file?.size;
    if (mediaType === 'video' && asset.duration && asset.duration / 1000 > MAX_SNOW_VIDEO_SECONDS + 1) {
      skipped.push(`A video is longer than ${MAX_SNOW_VIDEO_SECONDS} seconds. Trim it and try again.`);
      continue;
    }
    if (sizeBytes && sizeBytes > MAX_SNOW_FILE_BYTES) {
      skipped.push(`A ${mediaType} is ${formatBytes(sizeBytes)}; the most one file can be is ${formatBytes(MAX_SNOW_FILE_BYTES)}.`);
      continue;
    }
    drafts.push({ uri: asset.uri, mediaType, mimeType: asset.mimeType ?? undefined, sizeBytes });
  }
  if (skipped.length > 0) notify('Some files weren\'t added', skipped.join('\n'));
  return drafts;
}
