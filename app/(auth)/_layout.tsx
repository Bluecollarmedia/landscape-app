/**
 * Auth Group Layout
 *
 * Minimal layout for login/signup screens.
 * No tab bar or header — just clean, focused auth UI.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    />
  );
}
