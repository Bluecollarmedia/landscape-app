import { Stack } from 'expo-router';

/** Stack over the owner Snow Mode tabs. Detail screens go beside (tabs) as they're built. */
export default function SnowOwnerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="storm-new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="storm/[id]" />
      <Stack.Screen name="route/[id]" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="hours" />
    </Stack>
  );
}
