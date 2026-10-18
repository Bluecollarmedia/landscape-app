import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

export const TERMS_REQUIRED_MESSAGE = 'Please agree to the Terms of Use and Privacy Policy to continue.';

/** "I agree to the Terms of Use and Privacy Policy" check box with links. Shown wherever an account is created. */
export function TermsAgreement({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(!value)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
        style={[styles.box, { borderColor: value ? colors.primary : colors.border, backgroundColor: value ? colors.primary : colors.surface }]}
      >
        {value ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
      </Pressable>
      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
        I agree to the{' '}
        <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => router.push('/legal/terms' as any)}>Terms of Use</Text>
        {' '}and{' '}
        <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => router.push('/legal/privacy' as any)}>Privacy Policy</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  box: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
