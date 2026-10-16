import type { MaintenanceStopDetail } from '@/types/maintenance';

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function servicesLabel(stop: MaintenanceStopDetail): string {
  const labels = stop.services.map(s => s.label).filter(Boolean);
  return labels.length ? labels.join(' + ') : 'Service';
}

export function stopAddress(stop: MaintenanceStopDetail): string {
  const p = stop.property;
  if (!p) return '';
  return [p.address, p.city].filter(Boolean).join(', ');
}
