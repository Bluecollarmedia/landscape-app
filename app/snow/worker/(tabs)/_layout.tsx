import { SnowTabs } from '@/components/snow/SnowTabs';

export default function SnowWorkerTabsLayout() {
  return (
    <SnowTabs
      tabs={[
        { name: 'index', title: 'Route', feather: 'navigation', sf: { default: 'map', selected: 'map.fill' } },
        { name: 'time', title: 'Time Clock', feather: 'clock', sf: { default: 'clock', selected: 'clock.fill' } },
        { name: 'settings', title: 'Settings', feather: 'settings', sf: { default: 'gearshape', selected: 'gearshape.fill' } },
      ]}
    />
  );
}
