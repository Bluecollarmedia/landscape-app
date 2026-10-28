import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { weatherSwitch } from '@/data/publicWeather';
import { WX, WeatherBackground } from '@/components/weather/WeatherUI';
import { FloatingTabBar } from '@/components/weather/FloatingTabBar';
import { WEATHER_ON_THIS_DEVICE } from '@/lib/weatherPlatform';

/**
 * The public Brighton Weather area: one light page behind its screens (Weather, Storm History, Our Work while the owner has it on, Request, Brighton) and its own floating tab bar.
 * The screens are tabs that stay alive once opened, so switching is instant and each keeps its place (scroll position, the hourly strip, the open storm).
 * The storm outlook page is a fourth, hidden tab: it has no button in the bar and is opened from the home card or the history.
 * While it is open the app re-asks the owner's switch every 60 seconds; if Weather has been switched off, the app's launch routing
 * moves the visitor to the welcome screen.
 */
export default function WeatherLayout() {
  useEffect(() => {
    const id = setInterval(() => { void weatherSwitch.refresh(); }, 60_000);
    return () => clearInterval(id);
  }, []);
  // The website has no public weather: anyone who types a weather address there goes to the normal entry.
  if (!WEATHER_ON_THIS_DEVICE) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: WX.page }}>
      <WeatherBackground />
      <Tabs
        backBehavior="history"
        tabBar={() => <FloatingTabBar />}
        screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: 'transparent' } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="work" />
        <Tabs.Screen name="work-post" options={{ href: null }} />
        <Tabs.Screen name="work-video" options={{ href: null }} />
        <Tabs.Screen name="work-story" options={{ href: null }} />
        <Tabs.Screen name="request" />
        <Tabs.Screen name="account" />
        <Tabs.Screen name="outlook" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
