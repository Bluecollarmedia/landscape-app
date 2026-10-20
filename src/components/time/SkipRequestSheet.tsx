import React, { useEffect, useState } from 'react';
import { View, Text, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Button, Input } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

/**
 * "Can't service this property?": the worker says why and sends a request. It does NOT skip anything: the property stays open
 * (and the route stays locked behind it) until the owner approves.
 */
export function SkipRequestSheet({ visible, propertyName, onClose, onSend }: {
  visible: boolean;
  propertyName?: string;
  onClose: () => void;
  onSend: (reason: string) => Promise<void> | void;
}) {
  const { colors } = useTheme();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setReason(''); setBusy(false); } }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>Ask to skip {propertyName ?? 'this property'}?</Text>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Tell the owner why it can't be done. It stays open until the owner approves the skip.
          </Text>
          <Input
            label="Reason"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            placeholder="Gate locked, customer away, equipment problem"
            containerStyle={{ marginTop: spacing.md }}
          />
          <View style={styles.row}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button
              title="Send Request"
              icon="send"
              loading={busy}
              disabled={reason.trim().length < 3}
              onPress={async () => { setBusy(true); await onSend(reason.trim()); setBusy(false); }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.xl, padding: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
