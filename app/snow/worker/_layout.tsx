import { Stack } from 'expo-router';

/** Stack over the worker Snow Mode tabs. Detail screens go beside (tabs) as they're built. */
export default function SnowWorkerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="edit-profile" />
    </Stack>
  );
}
