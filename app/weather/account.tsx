import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { Floaty, GlassCard } from '@/components/weather/WeatherUI';

/** Account. Just a way in: Sign In opens the app's existing welcome and sign-in screens, unchanged. */
export default function WeatherAccount() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView bounces={false} contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: insets.bottom + 130 }}>
      <Text style={styles.title}>{t('Account')}</Text>
      <Text style={styles.sub}>{t('Sign in to use your Brighton account.')}</Text>
      <Floaty delay={300} style={{ marginTop: 22 }}>
        <Pressable onPress={() => router.push('/(auth)/welcome' as any)} accessibilityRole="button" accessibilityLabel={t('Sign In')}>
          <GlassCard style={{ borderRadius: 22 }}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="account-circle-outline" size={28} color="#FFFFFF" />
              <Text style={styles.rowText}>{t('Sign In')}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
            </View>
          </GlassCard>
        </Pressable>
      </Floaty>
      <View style={{ marginTop: 24, alignItems: 'flex-start' }}>
        <LanguageSwitch />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '600' },
  sub: { color: 'rgba(255,255,255,0.86)', fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  rowText: { flex: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
