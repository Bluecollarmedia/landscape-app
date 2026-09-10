/**
 * Root Layout
 *
 * Wraps the entire app in providers (Theme, Auth) and handles
 * the splash screen lifecycle. Routes based on auth + onboarding state.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { SplashScreen } from '@/components/branding/SplashScreen';

ExpoSplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, isAuthenticated, user, appState, onboardingStep } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      ExpoSplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading || !splashDone) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const currentGroup = segments[0];

    if (appState === 'unauthenticated') {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
      return;
    }

    if (appState === 'onboarding') {
      if (!inOnboardingGroup) {
        router.replace('/(onboarding)/join-team');
      }
      return;
    }

    if (appState === 'pending_approval') {
      if (!inOnboardingGroup || segments[1] !== 'pending-approval') {
        router.replace('/(onboarding)/pending-approval');
      }
      return;
    }

    if (appState === 'declined') {
      if (!inOnboardingGroup) {
        router.replace('/(onboarding)/declined');
      }
      return;
    }

    if (appState === 'active' && isAuthenticated && user) {
      const roleGroup = `(${user.role})`;
      if (inAuthGroup || inOnboardingGroup || currentGroup !== roleGroup) {
        switch (user.role) {
          case 'owner':
            router.replace('/(owner)');
            break;
          case 'worker':
            router.replace('/(worker)');
            break;
          case 'customer':
            router.replace('/(customer)');
            break;
        }
      }
    }
  }, [isLoading, isAuthenticated, user, appState, onboardingStep, segments, splashDone]);

  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (isLoading || !splashDone) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
