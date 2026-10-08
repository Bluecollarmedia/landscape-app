import { useMemo, useCallback } from 'react';
import type { CompanyMember, PersonSummary } from '@/types/company';
import type { Project } from '@/types/project';
import { db, useDb, insertRow, rowsOf } from '@/data/store';

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
  const v = useDb();

  const customers = useMemo<CustomerWithProjects[]>(() => {
    return db.members
      .filter((m) => m.role === 'customer' && m.status !== 'inactive' && m.person)
      .map((m) => {
        const person = m.person!;
        const customerProjects = db.projects.filter((p) => p.customerId === m.personId);
        return {
          member: m,
          person,
          projects: customerProjects,
          activeProjectCount: customerProjects.filter((p) => p.status === 'active').length,
          totalProjectCount: customerProjects.length,
        };
      });
  }, [v]);

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

  /**
   * Adds a customer to the company. They show up right away; when they later
   * create an account with the same email, it links to this record and they
   * see the projects assigned to them.
   */
  const addCustomer = useCallback((input: { firstName: string; lastName: string; email?: string; phone?: string }) => {
    const email = (input.email ?? '').trim().toLowerCase();
    // Reuse an existing person with this email (e.g. already a customer elsewhere).
    const existing = email
      ? rowsOf('people').find((p) => (p.email ?? '').toLowerCase() === email)
      : undefined;
    const personId: string = existing?.id ?? insertRow('people', {
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone?.trim() || undefined,
    }).id;
    const alreadyMember = db.members.find((m) => m.personId === personId);
    if (!alreadyMember) {
      insertRow('company_members', {
        personId,
        role: 'customer',
        status: existing?.userId ? 'active' : 'invited',
        joinMethod: 'email_invitation',
        approvedBy: db.personId || undefined,
        approvedAt: new Date().toISOString(),
      });
    }
    return personId;
  }, []);

  const getCustomer = useCallback(
    (personId: string) => customers.find((c) => c.person.id === personId),
    [customers],
  );

  return { customers: filtered, allCustomers: customers, addCustomer, getCustomer };
}
