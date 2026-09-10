/**
 * ScreenContainer — Standard Screen Wrapper
 *
 * Handles safe areas, scroll behavior, background color,
 * and max-width centering for tablet/web layouts.
 */

import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { spacing, sizing } from '@/theme/spacing';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  centered?: boolean;
  keyboardAvoiding?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function ScreenContainer({
  children,
  scrollable = true,
  padded = true,
  centered = false,
  keyboardAvoiding = false,
  style,
  contentStyle,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const outerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
  };

  const innerStyle: ViewStyle = {
    flex: scrollable ? undefined : 1,
    ...(padded ? { paddingHorizontal: spacing.lg } : {}),
    ...(centered
      ? {
          maxWidth: sizing.maxContentWidth,
          width: '100%',
          alignSelf: 'center' as const,
        }
      : {}),
    paddingBottom: insets.bottom || spacing.lg,
    ...contentStyle,
  };

  const content = <View style={innerStyle}>{children}</View>;

  const scrollContent = scrollable ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  ) : (
    content
  );

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {scrollContent}
    </KeyboardAvoidingView>
  ) : (
    scrollContent
  );

  return <View style={[outerStyle, style]}>{wrapped}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
