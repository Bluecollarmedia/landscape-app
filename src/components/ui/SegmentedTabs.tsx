/**
 * SegmentedTabs — the Liquid Glass segmented control (same look as the
 * Schedule tab's Day/Week switch), for screens that flip between two or
 * three views such as Pending / History.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useTheme } from '@/providers/ThemeProvider';
import { spacing } from '@/theme/spacing';
import { haptics } from '@/lib/haptics';

interface SegmentedTabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedTabs<T extends string>({ options, value, onChange }: SegmentedTabsProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <SegmentedControl
        values={options.map((o) => o.label)}
        selectedIndex={Math.max(0, options.findIndex((o) => o.value === value))}
        onChange={(event) => {
          const next = options[event.nativeEvent.selectedSegmentIndex];
          if (next && next.value !== value) {
            haptics.select();
            onChange(next.value);
          }
        }}
        tintColor={colors.primary}
        appearance="light"
        backgroundColor={colors.groupedBackground}
        fontStyle={{ color: colors.textSecondary }}
        activeFontStyle={{ color: '#FFFFFF', fontWeight: '600' }}
        style={styles.control}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  control: { height: 36 },
});
