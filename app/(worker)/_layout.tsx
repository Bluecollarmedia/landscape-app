import { Redirect, Stack, useSegments } from 'expo-router';
import { WorkerProvider } from '@/providers/WorkerProvider';
import { useIsMaintenanceWorker } from '@/hooks/useMaintenance';

/** Regular-crew screens a maintenance worker never opens (project jobs, tasks and day logs). */
const LANDSCAPING_ONLY = ['(tabs)', 'job', 'task', 'day'];
/** Maintenance-crew screens a regular worker never opens. */
const MAINTENANCE_ONLY = ['maintenance', 'maintenance-stop'];

/**
 * Stack that sits above the (tabs) navigator. Detail screens (task, job,
 * day, edit profile, notifications) live here rather than inside the tab
 * navigator because native tabs can't navigate to routes that aren't
 * declared as tab triggers — pushing them from a tab silently did nothing.
 *
 * Maintenance workers have their own tab bar (`maintenance/`: Today, Route,
 * Activity, Settings). Both kinds of worker share the profile, notification
 * and resource screens; each is kept out of the other's work screens.
 */
export default function WorkerLayout() {
  const segments = useSegments() as string[];
  const isMaintenance = useIsMaintenanceWorker();
  // segments[1] is the screen under (worker); undefined means the default (tabs) index.
  const screen = segments[1] ?? '(tabs)';

  if (isMaintenance && LANDSCAPING_ONLY.includes(screen)) {
    return <Redirect href={'/(worker)/maintenance' as any} />;
  }
  if (!isMaintenance && MAINTENANCE_ONLY.includes(screen)) {
    return <Redirect href={'/(worker)' as any} />;
  }

  return (
    <WorkerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="maintenance" />
        <Stack.Screen name="maintenance-stop/[id]" />
        <Stack.Screen name="task/[id]" />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="day/[date]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="my-resources" />
        <Stack.Screen name="resource/[id]" />
      </Stack>
    </WorkerProvider>
  );
}
