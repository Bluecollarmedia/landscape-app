import { useState, useMemo, useCallback } from 'react';
import type { Truck, TruckStatus } from '@/types/truck';
import { mockTrucks } from '@/data/mock';

interface UseTrucksOptions {
  statusFilter?: TruckStatus | 'all';
}

export function useTrucks(options: UseTrucksOptions = {}) {
  const { statusFilter = 'all' } = options;
  const [trucks, setTrucks] = useState<Truck[]>(mockTrucks);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return trucks;
    return trucks.filter((t) => t.status === statusFilter);
  }, [trucks, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: trucks.length, available: 0, assigned: 0, maintenance: 0, out_of_service: 0 };
    for (const t of trucks) {
      c[t.status]++;
    }
    return c;
  }, [trucks]);

  const addTruck = useCallback((truck: Omit<Truck, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTruck: Truck = {
      ...truck,
      id: `truck_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTrucks((prev) => [...prev, newTruck]);
  }, []);

  const updateTruck = useCallback((id: string, updates: Partial<Truck>) => {
    setTrucks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t)),
    );
  }, []);

  return { trucks: filtered, allTrucks: trucks, counts, addTruck, updateTruck };
}
