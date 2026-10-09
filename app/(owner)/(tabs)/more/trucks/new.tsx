import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Modal, Alert, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { db } from '@/data/store';
import { attachImage } from '@/data/actions';
import { useTrucks } from '@/hooks/useTrucks';
import { OptimizedImage } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import type { TruckStatus } from '@/types/truck';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';

const STATUS_OPTIONS: { key: TruckStatus; label: string; dot: string }[] = [
  { key: 'available', label: 'Available', dot: semantic.success },
  { key: 'assigned', label: 'Assigned', dot: semantic.info },
  { key: 'maintenance', label: 'Maintenance', dot: semantic.warning },
];

export default function AddTruckScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addTruck } = useTrucks();

  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [status, setStatus] = useState<TruckStatus>('available');
  const [notes, setNotes] = useState('');

  async function handleTakePhoto() {
    setShowPhotoSheet(false);
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      setPermissionError('Camera access is needed to take a vehicle photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
  }

  async function handleChooseFromLibrary() {
    setShowPhotoSheet(false);
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      setPermissionError('Photo library access is needed to choose a vehicle photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
  }

  function handleRemovePhoto() {
    setShowPhotoSheet(false);
    setPhotoUri(undefined);
  }

  function handleAdd() {
    if (!name.trim()) {
      const msg = 'Please enter a truck name.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Required', msg);
      return;
    }
    const truck = addTruck({
      companyId: db.companyId,
      name: name.trim(),
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      year: year.trim() ? Number(year.trim()) : undefined,
      licensePlate: plate.trim() || undefined,
      status,
      notes: notes.trim() || undefined,
    });
    attachImage('trucks', truck.id, 'photoUrl', photoUri, 'trucks');
    router.back();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to Trucks">
          <Icon name="chevron-left" size={22} color={colors.primary} />
          <Text style={[typeScale.bodyLarge, { color: colors.primary }]}>Trucks</Text>
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>Add Truck</Text>
        <View style={{ width: 70 }} />
      </View>

      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable
          style={[styles.photoBox, { borderColor: colors.borderLight }]}
          onPress={() => setShowPhotoSheet(true)}
        >
          {photoUri ? (
            <>
              <OptimizedImage source={photoUri} style={styles.photoPreview} />
              <View style={[styles.photoEditBadge, { backgroundColor: colors.primary }]}>
                <Icon name="camera" size={14} color="#FFFFFF" />
              </View>
            </>
          ) : (
            <>
              <View style={[styles.photoIconCircle, { backgroundColor: colors.primarySurface }]}>
                <Icon name="camera" size={28} color={colors.primary} />
              </View>
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700', marginTop: spacing.md }]}>
                Add a photo (optional)
              </Text>
              <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                Helps easily identify this vehicle
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.field}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Name</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.borderLight, color: colors.textPrimary }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Truck #5"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Make</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.borderLight, color: colors.textPrimary }]}
              value={make}
              onChangeText={setMake}
              placeholder="e.g. Ford"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Model</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.borderLight, color: colors.textPrimary }]}
              value={model}
              onChangeText={setModel}
              placeholder="e.g. F-250"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Year</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.borderLight, color: colors.textPrimary }]}
              value={year}
              onChangeText={(v) => setYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="e.g. 2022"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>License Plate</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.borderLight, color: colors.textPrimary }]}
              value={plate}
              onChangeText={setPlate}
              placeholder="e.g. OH-BLL-101"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Status</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.statusPill,
                    { backgroundColor: active ? `${opt.dot}1A` : colors.backgroundTertiary, borderColor: active ? opt.dot : 'transparent' },
                  ]}
                  onPress={() => setStatus(opt.key)}
                >
                  <View style={[styles.statusDot, { backgroundColor: opt.dot }]} />
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: active ? '700' : '500' }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { borderColor: colors.borderLight, color: colors.textPrimary }]}
            value={notes}
            onChangeText={(v) => setNotes(v.slice(0, 200))}
            placeholder="e.g. Primary crew truck, needs new tires, etc."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={200}
          />
          <Text style={[typeScale.caption, { color: colors.textTertiary, textAlign: 'right', marginTop: 2 }]}>{notes.length}/200</Text>
        </View>

        <Pressable style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAdd}>
          <Icon name="plus" size={18} color="#FFFFFF" />
          <Text style={[typeScale.labelLarge, { color: '#FFFFFF', fontWeight: '700', marginLeft: spacing.xs }]}>Add Truck</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      {/* Photo source sheet */}
      <BottomSheetModal visible={showPhotoSheet} onRequestClose={() => setShowPhotoSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowPhotoSheet(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderLight }]} />
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md }]}>
              Vehicle Photo
            </Text>
            <Pressable style={styles.sheetOption} onPress={handleTakePhoto}>
              <Icon name="camera" size={18} color={colors.textPrimary} />
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginLeft: spacing.md }]}>Take Photo</Text>
            </Pressable>
            <View style={[styles.sheetDivider, { backgroundColor: colors.borderLight }]} />
            <Pressable style={styles.sheetOption} onPress={handleChooseFromLibrary}>
              <Icon name="image" size={18} color={colors.textPrimary} />
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginLeft: spacing.md }]}>Choose from Library</Text>
            </Pressable>
            {photoUri && (
              <>
                <View style={[styles.sheetDivider, { backgroundColor: colors.borderLight }]} />
                <Pressable style={styles.sheetOption} onPress={handleRemovePhoto}>
                  <Icon name="trash-2" size={18} color={semantic.error} />
                  <Text style={[typeScale.bodyLarge, { color: semantic.error, marginLeft: spacing.md }]}>Remove Photo</Text>
                </Pressable>
              </>
            )}
            <Pressable style={[styles.sheetCancel, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setShowPhotoSheet(false)}>
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </BottomSheetModal>

      {/* Permission error */}
      <Modal visible={!!permissionError} transparent animationType="fade" onRequestClose={() => setPermissionError(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={[styles.confirmCard, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, textAlign: 'center' }]}>Permission Needed</Text>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
              {permissionError}
            </Text>
            <Pressable style={[styles.confirmButton, { backgroundColor: colors.primary }]} onPress={() => setPermissionError(null)}>
              <Text style={[typeScale.labelLarge, { color: '#FFFFFF' }]}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', width: 70 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] + 90 },
  photoBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  photoIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: radius.sm,
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typeScale.bodyLarge.fontSize,
  },
  notesInput: { minHeight: 90, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    ...shadow.sm,
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  sheetOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  sheetDivider: { height: StyleSheet.hairlineWidth },
  sheetCancel: { marginTop: spacing.sm, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  confirmCard: { width: '100%', borderRadius: radius.md, padding: spacing.lg },
  confirmButton: { marginTop: spacing.lg, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center' },
});
