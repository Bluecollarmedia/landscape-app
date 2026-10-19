/**
 * Root Layout
 *
 * Wraps the entire app in providers (Theme, Auth) and handles
 * the splash screen lifecycle. Routes based on auth + onboarding state.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { usePrefetchKeyImages } from '@/lib/imageCache';
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
import { useModeAccess } from '@/hooks/useModeAccess';

ExpoSplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, isAuthenticated, user, appState, onboardingStep } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);
  // The approval page (/approve/<token>), the legal pages (/legal/privacy, terms, support) and the password reset page are public:
  // no sign-in, no redirects.
  const isPublicPage = ['approve', 'legal', 'reset-password'].includes((segments as string[])[0]);
  const { shell } = useModeAccess(user?.role);

  usePushNotifications(user?.role, appState === 'active' && isAuthenticated && !!user);
  usePrefetchKeyImages();

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
      if (!inOnboardingGroup || (segments as string[])[1] !== 'pending-approval') {
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
      // Snow Mode has its own shells under /snow/<role>. Which one a person
      // sees comes from useModeAccess: the company's mode, limited to the
      // modes this person is allowed into (the mode itself grants nothing).
      if (user.role !== 'owner' && user.role !== 'worker' && user.role !== 'customer') return;
      const role = user.role;
      const target =
        shell === 'snow' ? `/snow/${role}` : shell === 'snow_notice' ? '/snow/notice' : `/(${role})`;
      const s1 = (segments as string[])[1];
      const onTarget =
        shell === 'snow' ? currentGroup === 'snow' && s1 === role
        : shell === 'snow_notice' ? currentGroup === 'snow' && s1 === 'notice'
        : currentGroup === `(${role})`;
      if (inAuthGroup || inOnboardingGroup || !onTarget) {
        router.replace(target as any);
      }
    }
  }, [isLoading, isAuthenticated, user, appState, onboardingStep, segments, splashDone, isPublicPage, shell]);

  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (!isPublicPage && (isLoading || !splashDone)) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // Same element tree for public and normal pages. If a public page (Privacy, Terms, Support) returned a different
  // tree, opening it would rebuild the whole navigator and Back would land on the Dashboard instead of the
  // screen you came from.
  return (
    <>
      <Slot />
      {isPublicPage ? null : <SignInWelcome />}
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
