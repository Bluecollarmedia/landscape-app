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
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { SplashScreen } from '@/components/branding/SplashScreen';
import { SignInWelcome } from '@/components/branding/WelcomeOverlay';
import { usePushNotifications } from '@/hooks/usePushNotifications';

ExpoSplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, isAuthenticated, user, appState, onboardingStep } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);
  // The approval page (/approve/<token>) is public: no sign-in, no redirects.
  const isPublicPage = (segments as string[])[0] === 'approve';

  usePushNotifications(user?.role, appState === 'active' && isAuthenticated && !!user);

  useEffect(() => {
    if (!isLoading) {
      ExpoSplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading || !splashDone || isPublicPage) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const currentGroup = segments[0];

    if (appState === 'unauthenticated') {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
      return;
    }

    // The setup hub links to the create-company / join-team / project-code
    // screens, which also work for an already-signed-in user.
    const setupScreens = ['create-company', 'join-team', 'customer-access'];
    const onSetupScreen = inAuthGroup && setupScreens.includes((segments as string[])[1] ?? '');

    if (appState === 'onboarding') {
      // Signed in but not part of a company yet.
      if (!inOnboardingGroup && !onSetupScreen) {
        router.replace('/(onboarding)/setup');
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
      // A declined person may try again with a new code.
      if (!inOnboardingGroup && !onSetupScreen) {
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
  }, [isLoading, isAuthenticated, user, appState, onboardingStep, segments, splashDone, isPublicPage]);

  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (isPublicPage) {
    return <Slot />;
  }

  if (isLoading || !splashDone) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <>
      <Slot />
      <SignInWelcome />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <KeyboardProvider>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
