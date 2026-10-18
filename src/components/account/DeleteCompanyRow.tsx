import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListRow, Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { db } from '@/data/store';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';

/**
 * Owner only: "Delete Company" row plus its confirmation sheet (type the
 * company name). The database does the delete as one all-or-nothing step
 * (delete_my_company, supabase/updates/036): if it fails nothing is deleted.
 * When it works the company's data is gone, accounts stay, and the welcome
 * screen offers "Create a Company" again.
 */
export function DeleteCompanyRow() {
  const { colors } = useTheme();
  const { signOut, memberRole } = useAuth();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Only the owner (not an admin) can delete the company; the database checks too.
  if (memberRole !== 'owner') return null;

  const companyName = db.company?.name ?? '';
  const ready = !!companyName && typed.trim().toLowerCase() === companyName.trim().toLowerCase();

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped('');
    setError('');
  }

  async function handleDelete() {
    if (!ready) return;
    if (!isSupabaseConfigured) {
      const msg = 'The company can’t be deleted in demo mode.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Demo mode', msg);
      return;
    }
    setBusy(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('delete_my_company', { p_confirm_name: typed.trim() });
    if (rpcError) {
      // Nothing was deleted; the company is still here.
      setBusy(false);
      setError(rpcError.message);
      return;
    }
    setBusy(false);
    setOpen(false);
    await signOut();
  }

  return (
    <>
      <ListRow icon="trash-2" iconColor={colors.error} title="Delete Company" destructive onPress={() => setOpen(true)} />

      <BottomSheetModal visible={open} onRequestClose={close}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.overlay} onPress={close}>
            <Pressable
              style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.iconWrap, { backgroundColor: semantic.errorLight }]}>
                <Icon name="alert-triangle" size={24} color={semantic.error} />
              </View>
              <Text style={[typeScale.headingLarge, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md }]}>
                Delete {companyName || 'the company'}?
              </Text>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
                This permanently deletes the company and everything in it: projects, workers' team membership, schedules, hours, photos, quotes, maintenance and snow records. Accounts are kept, but nobody will have a company until a new one is created. This can't be undone.
              </Text>
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
                Type the company name to confirm
              </Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                placeholder={companyName}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[typeScale.bodyLarge, styles.input, { color: colors.textPrimary, borderColor: ready ? semantic.error : colors.border }]}
              />
              {error ? (
                <Text style={[typeScale.caption, { color: semantic.error, marginTop: spacing.xs }]}>{error}</Text>
              ) : null}
              <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                <Button title="Delete Company" onPress={handleDelete} variant="danger" fullWidth disabled={!ready} loading={busy} />
                <Button title="Cancel" onPress={close} variant="ghost" fullWidth />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  input: { borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
