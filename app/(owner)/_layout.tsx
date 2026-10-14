import { Stack } from 'expo-router';
import { ScheduleProvider } from '@/providers/ScheduleProvider';

/**
 * Stack that sits above the (tabs) navigator. Screens declared here with
 * presentation: 'modal' are reachable from ANY tab (Dashboard quick actions,
 * a detail screen's own actions, etc.) without switching the selected bottom
 * tab, because they live outside the tab navigator's own route tree —
 * dismissing one always returns to whatever tab/screen was underneath.
 */
export default function OwnerLayout() {
  return (
    <ScheduleProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="worker-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="project-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="schedule-create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notification-center" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        {/* Company Resources: opened from More and from Workers, so it sits
            above the tabs (a normal push) and its forms are modals. */}
        <Stack.Screen name="resources" />
        <Stack.Screen name="resource-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="resource-access" options={{ presentation: 'modal' }} />
        <Stack.Screen name="worker-access" options={{ presentation: 'modal' }} />
        {/* Crews: opened from Workers and from a worker's profile. */}
        <Stack.Screen name="crews" />
        <Stack.Screen name="crew-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="document" />
        <Stack.Screen name="document-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="document-edit" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="setup" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
    </ScheduleProvider>
  );
}
