export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function servicesLabel(services: string[]): string {
  if (services.length === 0) return 'Service';
  return services.join(' + ');
}
