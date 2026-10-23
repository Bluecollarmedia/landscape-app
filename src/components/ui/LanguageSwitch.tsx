import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { LANGUAGES, useLanguage, useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

/**
 * English | Español. Small on purpose: a pill for the sign-in / sign-up screens (so someone can read the page in Spanish before they sign up),
 * and the same switch as one quiet row in Settings. The choice stays on this phone.
 */
export function LanguageSwitch({ style }: { style?: object }) {
  const { colors } = useTheme();
  const { language, setLanguage } = useLanguage();
  const t = useT();
  return (
    <View style={[styles.pill, { backgroundColor: colors.backgroundTertiary, borderColor: colors.borderLight }, style]} accessibilityRole="radiogroup" accessibilityLabel={t('Language')}>
      {LANGUAGES.map((l) => {
        const on = language === l.key;
        return (
          <Pressable
            key={l.key}
            onPress={() => { if (!on) { haptics.select(); setLanguage(l.key); } }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={l.label}
            hitSlop={6}
            style={[styles.segment, on && { backgroundColor: colors.primary }]}
          >
            <Text style={[typeScale.labelSmall, { color: on ? '#FFFFFF' : colors.textSecondary, fontWeight: '700' }]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One row for Settings: the label on the left, the switch on the right. */
export function LanguageRow() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={styles.row}>
      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{t('Language')}</Text>
      <LanguageSwitch />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, padding: 2, alignSelf: 'flex-start' },
  segment: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, minWidth: 64, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
});
