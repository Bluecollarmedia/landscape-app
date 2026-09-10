import { useMemo } from 'react';
import { mockProjects, mockMembers } from '@/data/mock';

export interface SearchResult {
  id: string;
  type: 'project' | 'worker' | 'customer';
  title: string;
  subtitle: string;
  icon: string;
}

export function useSearch(query: string) {
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    for (const p of mockProjects) {
      if (
        p.name.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.customer?.firstName.toLowerCase().includes(q) ||
        p.customer?.lastName.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q)
      ) {
        items.push({
          id: p.id,
          type: 'project',
          title: p.name,
          subtitle: `${p.status} · ${p.address ?? ''}`,
          icon: 'folder',
        });
      }
    }

    for (const m of mockMembers) {
      if (!m.person) continue;
      const p = m.person;
      const name = `${p.firstName} ${p.lastName}`;
      if (
        name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone?.includes(q)
      ) {
        if (m.role === 'worker') {
          items.push({
            id: p.id,
            type: 'worker',
            title: name,
            subtitle: `Worker · ${p.email}`,
            icon: 'users',
          });
        } else if (m.role === 'customer') {
          items.push({
            id: p.id,
            type: 'customer',
            title: name,
            subtitle: `Customer · ${p.email}`,
            icon: 'user',
          });
        }
      }
    }

    return items;
  }, [query]);

  return { results };
}
