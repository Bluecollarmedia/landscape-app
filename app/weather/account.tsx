import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { Panel, WX } from '@/components/weather/WeatherUI';

/** Account. Just a way in: Sign In opens the app's existing welcome and sign-in screens, unchanged. */
export default function WeatherAccount() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: insets.bottom + 130 }}>
      <Text style={styles.title}>{t('Account')}</Text>
      <Text style={styles.sub}>{t('Sign in to use your Brighton account.')}</Text>
      <Pressable onPress={() => router.push('/(auth)/welcome' as any)} accessibilityRole="button" accessibilityLabel={t('Sign In')} style={({ pressed }) => [{ marginTop: 22 }, pressed && { opacity: 0.8 }]}>
        <Panel>
          <View style={styles.row}>
            <MaterialCommunityIcons name="account-circle-outline" size={28} color={WX.deep} />
            <Text style={styles.rowText}>{t('Sign In')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color={WX.faint} />
          </View>
        </Panel>
      </Pressable>
      <View style={{ marginTop: 24, alignItems: 'flex-start' }}>
        <LanguageSwitch />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: WX.deep, fontSize: 28, fontWeight: '600' },
  sub: { color: WX.soft, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, minHeight: 64 },
  rowText: { flex: 1, color: WX.ink, fontSize: 17, fontWeight: '600' },
});
