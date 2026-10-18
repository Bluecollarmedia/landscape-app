import { Redirect } from 'expo-router';
import { MyRouteScreen } from '@/components/snow/routes/MyRouteScreen';
import { useIsRouteLead } from '@/hooks/useIsRouteLead';

export default function WorkerRouteTab() {
  const isLead = useIsRouteLead();
  // A worker who doesn't lead a route lands on the time clock instead.
  if (isLead === false) return <Redirect href="/snow/worker/time" />;
  return <MyRouteScreen />;
}
