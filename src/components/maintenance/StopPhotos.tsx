/**
 * Photos for one maintenance visit. Every photo is internal (company only):
 * the database refuses a crew upload marked customer-visible, so a worker's
 * photo never reaches a customer on its own. Uploads run in the background
 * and don't count toward the requirement until they've finished.
 */

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Icon, PressableScale } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { db } from '@/data/store';
import { addStopPhoto, removeStopPhoto } from '@/data/maintenance';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';
import type { MaintenancePhoto } from '@/types/maintenance';

interface Props {
  stopId: string;
  photos: MaintenancePhoto[];
  requiresPhotos: boolean;
  minPhotos: number;
  locked: boolean;
}

const isUploaded = (p: MaintenancePhoto) => db.demo || /^https?:\/\//i.test(p.fileUrl);

export function StopPhotos({ stopId, photos, requiresPhotos, minPhotos, locked }: Props) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const saved = photos.filter(isUploaded).length;
  const staff = db.role === 'owner' || db.role === 'admin';

  function confirm(title: string, message: string, action: string, run: () => void) {
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (m: string) => boolean }).confirm?.(`${title}\n\n${message}`)) run();
      return;
    }
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: run }]);
  }

  function handleAdd() {
    if (Platform.OS === 'web') return pick('library');
    Alert.alert('Add Photo', undefined, [
      { text: 'Take Photo', onPress: () => pick('camera') },
      { text: 'Choose from Library', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pick(source: 'camera' | 'library') {
    setBusy(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            source === 'camera' ? 'Camera access needed' : 'Photo access needed',
            'Turn it on for Brighton Lawn in the Settings app to add stop photos.',
          );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: source === 'library', selectionLimit: 6 };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        for (const a of result.assets) addStopPhoto(stopId, a.uri);
        if (result.assets.length) haptics.success();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
          {requiresPhotos
            ? `${Math.min(saved, minPhotos)} of ${minPhotos} required photo${minPhotos === 1 ? '' : 's'}`
            : photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Photos are optional here'}
        </Text>
        <View style={[styles.internalPill, { backgroundColor: colors.backgroundTertiary }]}>
          <Icon name="lock" size={11} color={colors.textSecondary} />
          <Text style={[typeScale.caption, { color: colors.textSecondary, fontWeight: '600' }]}>Company only</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {photos.map((p) => {
          const uploading = !isUploaded(p);
          const canRemove = !locked && (staff || p.uploadedBy === db.personId);
          return (
            <View key={p.id} style={[styles.tile, { backgroundColor: colors.groupedBackground }]}>
              <Image source={{ uri: p.fileUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {uploading && (
                <View style={[StyleSheet.absoluteFill, styles.uploading]}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={[typeScale.caption, { color: '#FFFFFF', marginTop: 4 }]}>Uploading</Text>
                </View>
              )}
              {canRemove && !uploading && (
                <PressableScale
                  onPress={() => confirm('Remove photo?', 'It will be deleted from this stop.', 'Remove', () => removeStopPhoto(p.id))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  style={styles.remove}
                >
                  <Icon name="x" size={14} color="#FFFFFF" />
                </PressableScale>
              )}
            </View>
          );
        })}
        {!locked && (
          <PressableScale
            onPress={handleAdd}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            style={[styles.tile, styles.addTile, { borderColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          >
            {busy ? <ActivityIndicator color={colors.primary} /> : <Icon name="camera" size={22} color={colors.primary} />}
            <Text style={[typeScale.caption, { color: colors.primary, fontWeight: '700', marginTop: 4 }]}>Add photo</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  internalPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  addTile: { borderWidth: 1.5, borderStyle: 'dashed' },
  uploading: { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(20,20,20,0.65)', alignItems: 'center', justifyContent: 'center',
  },
});
