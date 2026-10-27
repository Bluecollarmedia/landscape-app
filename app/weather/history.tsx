import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { Panel, WX } from '@/components/weather/WeatherUI';

/** Storm History. Brighton's own storm updates will appear here once the owner starts posting them (a later phase). */
export default function WeatherHistory() {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: insets.bottom + 130 }}>
      <Text style={styles.title}>{t('Storm History')}</Text>
      <Text style={styles.sub}>{t('Past storm updates from Brighton.')}</Text>
      <Panel style={{ marginTop: 22 }}>
        <View style={styles.pad}>
          <MaterialCommunityIcons name="weather-snowy-heavy" size={30} color="#6FA8D8" />
          <Text style={styles.cardTitle}>{t('No storm updates yet')}</Text>
          <Text style={styles.cardBody}>{t('When Brighton posts a storm outlook, it will appear here.')}</Text>
        </View>
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: WX.deep, fontSize: 28, fontWeight: '600' },
  sub: { color: WX.soft, fontSize: 14, marginTop: 4 },
  pad: { padding: 18, gap: 6 },
  cardTitle: { color: WX.ink, fontSize: 16, fontWeight: '700', marginTop: 8 },
  cardBody: { color: WX.soft, fontSize: 14, lineHeight: 20 },
});
