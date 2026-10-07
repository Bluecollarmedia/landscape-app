import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkerContext } from '@/providers/WorkerProvider';
import { ListSection, ListRow } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, updateNotificationsEnabled } = useWorkerContext();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.replace('/(worker)/settings' as any)} hitSlop={12} style={styles.backRow}>
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>Settings</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginBottom: spacing.lg }]}>
          Notifications
        </Text>

        <ListSection footer="Push notifications require device permission and a connected notification service, which aren't set up yet. This switch is saved but doesn't send anything until that's in place.">
          <ListRow
            icon="bell"
            title="Push Notifications"
            subtitle="Job updates, schedule changes, and reminders"
            rightElement={
              <Pressable
                onPress={() => updateNotificationsEnabled(!settings.notificationsEnabled)}
                style={[
                  styles.toggle,
                  { backgroundColor: settings.notificationsEnabled ? colors.primary : colors.borderLight },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    { transform: [{ translateX: settings.notificationsEnabled ? 18 : 2 }] },
                  ]}
                />
              </Pressable>
            }
          />
        </ListSection>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: spacing.lg },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
});
