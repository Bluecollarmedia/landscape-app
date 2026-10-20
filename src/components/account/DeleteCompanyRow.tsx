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
  // What is still going on right now (from the database). Closing is refused while someone is clocked in or a storm is dispatched.
  const [preview, setPreview] = useState<Record<string, number> | null>(null);

  // Only the owner (not an admin) can delete the company; the database checks too.
  if (memberRole !== 'owner') return null;

  const companyName = db.company?.name ?? '';
  const ready = !!companyName && typed.trim().toLowerCase() === companyName.trim().toLowerCase();

  async function openSheet() {
    setOpen(true);
    setPreview(null);
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.rpc('company_closure_preview');
    if (data) setPreview(data as Record<string, number>);
  }

  const stillGoing: string[] = [];
  if (preview) {
    if (preview.on_the_clock > 0) stillGoing.push(`${preview.on_the_clock} person(s) are clocked in right now. Clock them out first (Hours & Labor).`);
    if (preview.dispatched_storms > 0) stillGoing.push(`${preview.dispatched_storms} snow storm(s) are still dispatched. End them first.`);
  }
  const heads: string[] = [];
  if (preview) {
    if (preview.days_awaiting_approval > 0) heads.push(`${preview.days_awaiting_approval} workday(s) still wait for your approval. They will be deleted with the company.`);
    if (preview.pending_join_requests + preview.pending_snow_requests > 0) heads.push(`${preview.pending_join_requests + preview.pending_snow_requests} join request(s) are waiting. They will be cancelled.`);
    if (preview.open_codes > 0) heads.push(`${preview.open_codes} invitation code(s) will stop working.`);
  }

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
      <ListRow icon="trash-2" iconColor={colors.error} title="Delete Company" destructive onPress={openSheet} />

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
                This PERMANENTLY deletes the company and everything it owns: projects, hours and payroll records, photos, storm and route history, quotes, maintenance records and every worker's team membership. It cannot be undone and nothing can be recovered. The records are deleted at once; stored photos and documents are removed from file storage shortly afterwards by a background clean-up, so they are not necessarily gone the instant you confirm. Logins are kept, so people could sign up again, but none of this data comes back.
              </Text>
              {stillGoing.map((t) => <Text key={t} style={[typeScale.bodySmall, { color: semantic.error, textAlign: 'center', marginTop: spacing.sm }]}>{t}</Text>)}
              {heads.map((t) => <Text key={t} style={[typeScale.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>{t}</Text>)}
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
                <Button title="Delete Company" onPress={handleDelete} variant="danger" fullWidth disabled={!ready || stillGoing.length > 0} loading={busy} />
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
