/**
 * Picking a photo for a maintenance stop (camera or library) and adding it to the stop. Shared by the Photos section and by
 * the checklist, which offers (or, when the property requires photos, insists on) a photo when a task is ticked.
 */
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { addStopPhoto } from '@/data/maintenance';
import { haptics } from '@/lib/haptics';

export type PhotoSource = 'camera' | 'library';

/** Opens the camera or library and adds what was picked to the stop. Resolves to how many photos were added (0 = cancelled or no permission). */
export async function pickStopPhotos(stopId: string, source: PhotoSource): Promise<number> {
  if (Platform.OS !== 'web') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        'Turn it on for Brighton Lawn in the Settings app to add stop photos.',
      );
      return 0;
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: source === 'library', selectionLimit: 6 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return 0;
  let added = 0;
  for (const a of result.assets) if (addStopPhoto(stopId, a.uri)) added++;
  if (added) haptics.success();
  return added;
}

/**
 * Asked when a checklist task is ticked and the stop has no photo yet.
 *  - required: a worker can't tick without adding one ("Please add a photo first").
 *  - optional: a worker can add one or skip, and the task is ticked either way.
 * Resolves true when the task should now be ticked.
 */
export function askForTaskPhoto(stopId: string, required: boolean): Promise<boolean> {
  const add = async (source: PhotoSource) => (await pickStopPhotos(stopId, source)) > 0;
  if (Platform.OS === 'web') return required ? add('library') : Promise.resolve(true);
  return new Promise((resolve) => {
    const buttons = [
      { text: 'Take Photo', onPress: async () => resolve((await add('camera')) || !required) },
      { text: 'Choose from Library', onPress: async () => resolve((await add('library')) || !required) },
      required
        ? { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(false) }
        : { text: 'Skip', style: 'cancel' as const, onPress: () => resolve(true) },
    ];
    Alert.alert(
      required ? 'Please add a photo first' : 'Add a photo?',
      required ? 'This property needs a photo before this task can be completed.' : 'A photo of the finished work is a good idea. You can skip it.',
      buttons,
      { cancelable: false },
    );
  });
}
