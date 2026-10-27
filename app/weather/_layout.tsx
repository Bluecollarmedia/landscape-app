import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { weatherSwitch } from '@/data/publicWeather';
import { WX, WeatherBackground } from '@/components/weather/WeatherUI';
import { FloatingTabBar } from '@/components/weather/FloatingTabBar';

/**
 * The public Brighton Weather area: one light page behind three screens (Weather, Storm History, Account) and its own floating tab bar.
 * While it is open the app re-asks the owner's switch every 60 seconds; if Weather has been switched off, the app's launch routing
 * moves the visitor to the welcome screen.
 */
export default function WeatherLayout() {
  useEffect(() => {
    const id = setInterval(() => { void weatherSwitch.refresh(); }, 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: WX.page }}>
      <WeatherBackground />
      <Slot />
      <FloatingTabBar />
    </View>
  );
}
