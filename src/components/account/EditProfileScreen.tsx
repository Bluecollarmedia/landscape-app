import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Avatar, Button, Input } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { uploadImage } from '@/lib/media';
import { squareAvatarUri } from '@/lib/avatarCrop';
import { loadMyBirthday, saveMyBirthday } from '@/data/birthday';
import { parseBirthday, birthdayProblem, birthdayInputText } from '@/lib/birthday';

interface EditProfileScreenProps {
  /** Workers must fill in every field (photo and phone included); owners only need a name. */
  requireAll?: boolean;
  backLabel?: string;
}

/** Edit your own name, phone and profile photo. Used by the worker and owner apps. */
export function EditProfileScreen({ requireAll = true, backLabel = 'Settings' }: EditProfileScreenProps) {
  const { colors } = useTheme();
  const { user, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [birthday, setBirthday] = useState('');
  const [savedBirthday, setSavedBirthday] = useState('');
  useEffect(() => {
    if (!user) return;
    let live = true;
    loadMyBirthday(user.id).then((iso) => {
      if (!live) return;
      const t = birthdayInputText(iso);
      setSavedBirthday(t);
      setBirthday((cur) => cur || t);
    });
    return () => { live = false; };
  }, [user?.id]);

  const hasChanges = birthday.trim() !== savedBirthday || firstName !== user?.firstName || lastName !== user?.lastName || phone !== (user?.phone ?? '') || avatarUrl !== user?.avatarUrl;

  const phoneDigits = phone.replace(/\D/g, '').length;
  const errors = {
    photo: !requireAll || avatarUrl ? '' : 'Add a profile photo',
    firstName: firstName.trim() ? '' : 'Enter your first name',
    lastName: lastName.trim() ? '' : 'Enter your last name',
    phone: phoneDigits >= 10 || (!requireAll && phoneDigits === 0) ? '' : 'Enter a 10-digit phone number',
    birthday: birthdayProblem(birthday),
  };
  const isValid = !Object.values(errors).some(Boolean);
  const show = (key: keyof typeof errors) => (triedSave ? errors[key] || undefined : undefined);

  async function handleSave() {
    if (!user) return;
    setTriedSave(true);
    if (!isValid) return;
    setSaving(true);
    setSaveError(null);
    try {
      // A newly picked photo is a file on this phone; upload it so everyone sees it.
      let savedAvatarUrl = avatarUrl;
      if (avatarUrl && avatarUrl !== user.avatarUrl) {
        savedAvatarUrl = (await uploadImage(avatarUrl, `avatars/${user.id}`)).url;
      }
      let birthdayNote: string | null = null;
      if (birthday.trim() !== savedBirthday) {
        const res = await saveMyBirthday(user.id, parseBirthday(birthday));
        if (!res.ok) birthdayNote = res.error;
      }
      updateProfile({
        ...user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        avatarUrl: savedAvatarUrl,
        updatedAt: new Date().toISOString(),
      });
      if (birthdayNote) {
        setSavedBirthday(savedBirthday);
        setSaveError(birthdayNote);
        return;
      }
      router.back();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Could not save your photo. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTakePhoto() {
    setPhotoSheetOpen(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPermissionError('Camera access is needed to take a profile photo. You can enable it in your device Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setAvatarUrl(await squareAvatarUri(a.uri, a.width, a.height));
    }
  }

  async function handleChooseFromGallery() {
    setPhotoSheetOpen(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPermissionError('Photo library access is needed to choose a profile photo. You can enable it in your device Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setAvatarUrl(await squareAvatarUri(a.uri, a.width, a.height));
    }
  }

  function handleRemovePhoto() {
    setPhotoSheetOpen(false);
    setAvatarUrl(undefined);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{backLabel}</Text>
        </Pressable>
        <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>Edit Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.photoSection}>
          <Pressable style={styles.avatarWrap} onPress={() => setPhotoSheetOpen(true)}>
            <Avatar firstName={firstName} lastName={lastName} size={96} uri={avatarUrl} />
            <View style={[styles.cameraBadgeLarge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <Feather name="camera" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
          <Pressable onPress={() => setPhotoSheetOpen(true)}>
            <Text style={[typeScale.bodyMedium, { color: colors.primary, fontWeight: '600', marginTop: spacing.sm }]}>
              {avatarUrl ? 'Change Photo' : 'Add Photo'}
            </Text>
          </Pressable>
          {show('photo') ? (
            <Text style={[typeScale.caption, { color: colors.error, marginTop: spacing.xs }]}>{show('photo')}</Text>
          ) : null}
        </View>

        <View style={styles.fields}>
          <View style={styles.nameRow}>
            <Input
              label="First Name *"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              textContentType="givenName"
              autoComplete="given-name"
              error={show('firstName')}
              containerStyle={{ flex: 1, width: undefined }}
            />
            <Input
              label="Last Name *"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              textContentType="familyName"
              autoComplete="family-name"
              error={show('lastName')}
              containerStyle={{ flex: 1, width: undefined }}
            />
          </View>
          <Input
            label={requireAll ? 'Phone Number *' : 'Phone Number'}
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 555-0100"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            icon="phone"
            error={show('phone')}
          />
          <Input
            label="Birthday (optional)"
            value={birthday}
            onChangeText={setBirthday}
            placeholder="MM/DD/YYYY"
            keyboardType="numbers-and-punctuation"
            icon="gift"
            error={show('birthday')}
            hint="Only you and your managers can see this."
          />
          <Input
            label="Email"
            value={user?.email ?? ''}
            editable={false}
            icon="mail"
            hint="Your email is your login and can't be changed here."
          />
        </View>

        <Button
          title="Save Changes"
          onPress={handleSave}
          disabled={!hasChanges || saving}
          loading={saving}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.xl }}
        />
        {saveError ? (
          <Text style={[typeScale.caption, { color: colors.error, marginTop: spacing.sm, textAlign: 'center' }]}>{saveError}</Text>
        ) : null}
      </KeyboardAwareScrollView>

      {/* Change Profile Photo sheet */}
      <BottomSheetModal visible={photoSheetOpen} onRequestClose={() => setPhotoSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPhotoSheetOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderLight }]} />
            <Text style={[typeScale.headingSmall, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md }]}>
              Change Profile Photo
            </Text>
            <Pressable style={styles.sheetOption} onPress={handleTakePhoto}>
              <Feather name="camera" size={18} color={colors.textPrimary} />
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginLeft: spacing.md }]}>Take Photo</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <Pressable style={styles.sheetOption} onPress={handleChooseFromGallery}>
              <Feather name="image" size={18} color={colors.textPrimary} />
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginLeft: spacing.md }]}>Choose from Gallery</Text>
            </Pressable>
            {avatarUrl && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                <Pressable style={styles.sheetOption} onPress={handleRemovePhoto}>
                  <Feather name="trash-2" size={18} color={colors.error} />
                  <Text style={[typeScale.bodyLarge, { color: colors.error, marginLeft: spacing.md }]}>Remove Current Photo</Text>
                </Pressable>
              </>
            )}
            <Pressable
              style={[styles.cancelButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setPhotoSheetOpen(false)}
            >
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
            <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
              {permissionError}
            </Text>
            <Pressable
              style={[styles.confirmButton, { backgroundColor: colors.primary, marginTop: spacing.lg, width: '100%' }]}
              onPress={() => setPermissionError(null)}
            >
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
  backRow: { flexDirection: 'row', alignItems: 'center', width: 90 },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  photoSection: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  avatarWrap: { position: 'relative' },
  cameraBadgeLarge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fields: { gap: spacing.md },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  sheetOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  cancelButton: {
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  confirmCard: { width: '100%', maxWidth: 340, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  confirmButton: { height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
