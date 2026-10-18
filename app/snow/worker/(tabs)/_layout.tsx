import { SnowTabs } from '@/components/snow/SnowTabs';
import { useIsRouteLead } from '@/hooks/useIsRouteLead';

export default function SnowWorkerTabsLayout() {
  // Only route leads need the Route tab. Everyone on the snow crew keeps Time
  // Clock and Settings. While we don't know yet, the tab stays.
  const isLead = useIsRouteLead();
  return (
    <SnowTabs
      tabs={[
        { name: 'index', title: 'Route', feather: 'navigation', sf: { default: 'map', selected: 'map.fill' }, hidden: isLead === false },
        { name: 'time', title: 'Time Clock', feather: 'clock', sf: { default: 'clock', selected: 'clock.fill' } },
        { name: 'settings', title: 'Settings', feather: 'settings', sf: { default: 'gearshape', selected: 'gearshape.fill' } },
      ]}
    />
  );
}
