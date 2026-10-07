import { useState, useMemo, useCallback } from 'react';
import type { CompanyMember, PersonSummary } from '@/types/company';
import type { Project } from '@/types/project';
import { mockMembers, mockProjects } from '@/data/mock';

export interface CustomerWithProjects {
  member: CompanyMember;
  person: PersonSummary;
  projects: Project[];
  activeProjectCount: number;
  totalProjectCount: number;
}

interface UseCustomersOptions {
  search?: string;
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const { search = '' } = options;
  const [members, setMembers] = useState<CompanyMember[]>(mockMembers);

  const customers = useMemo<CustomerWithProjects[]>(() => {
    return members
      .filter((m) => m.role === 'customer')
      .map((m) => {
        const person = m.person!;
        const customerProjects = mockProjects.filter((p) => p.customerId === m.personId);
        return {
          member: m,
          person,
          projects: customerProjects,
          activeProjectCount: customerProjects.filter((p) => p.status === 'active').length,
          totalProjectCount: customerProjects.length,
        };
      });
  }, [members]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.person.firstName.toLowerCase().includes(q) ||
        c.person.lastName.toLowerCase().includes(q) ||
        c.person.email.toLowerCase().includes(q) ||
        c.person.phone?.includes(q) ||
        c.projects.some((p) => p.name.toLowerCase().includes(q)),
    );
  }, [customers, search]);

  const addCustomer = useCallback((person: PersonSummary) => {
    const newMember: CompanyMember = {
      id: `cm_${Date.now()}`,
      companyId: 'company1',
      personId: person.id,
      role: 'customer',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      person,
    };
    setMembers((prev) => [...prev, newMember]);
  }, []);

  const getCustomer = useCallback(
    (personId: string) => customers.find((c) => c.person.id === personId),
    [customers],
  );

  return { customers: filtered, allCustomers: customers, addCustomer, getCustomer };
}
