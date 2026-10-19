import { Stack } from 'expo-router';

/** Stack over the owner Snow Mode tabs. Detail screens go beside (tabs) as they're built. */
export default function SnowOwnerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="storm-new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="storm/[id]" />
      <Stack.Screen name="route/[id]" />
      <Stack.Screen name="property" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="hours" />
      <Stack.Screen name="review" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="manage-storms" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="properties-list" />
      <Stack.Screen name="team-list" />
    </Stack>
  );
}
