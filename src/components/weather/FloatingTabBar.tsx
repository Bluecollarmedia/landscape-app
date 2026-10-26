import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { GlassCard, Floaty } from '@/components/weather/WeatherUI';

const TABS: { path: string; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { path: '/weather', label: 'Weather', icon: 'weather-partly-cloudy' },
  { path: '/weather/history', label: 'Storm History', icon: 'history' },
  { path: '/weather/account', label: 'Account', icon: 'account-outline' },
];

/** The Weather area's own tab bar: a floating glass capsule. (The app's other tab bars are untouched.) */
export function FloatingTabBar() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 4 }]} pointerEvents="box-none">
      <Floaty delay={400}>
        <GlassCard style={styles.bar} solid>
          <View style={styles.row}>
            {TABS.map((tab) => {
              const on = tab.path === '/weather' ? pathname === '/weather' || pathname === '/weather/' : pathname.startsWith(tab.path);
              return (
                <Pressable
                  key={tab.path}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(tab.label)}
                  onPress={() => { if (!on) router.replace(tab.path as any); }}
                  style={[styles.item, on && styles.itemOn]}
                >
                  <MaterialCommunityIcons name={tab.icon} size={22} color="#FFFFFF" />
                  <Text style={[styles.label, on && { fontWeight: '700' }]} numberOfLines={1}>{t(tab.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>
      </Floaty>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 18, right: 18 },
  bar: { borderRadius: 99 },
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 8 },
  item: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 99, minWidth: 86 },
  itemOn: { backgroundColor: 'rgba(255,255,255,0.26)' },
  label: { color: '#FFFFFF', fontSize: 10, marginTop: 2 },
});
