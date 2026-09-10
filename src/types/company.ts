export interface Company {
  id: string;
  name: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  createdAt: string;
  updatedAt: string;
}

export type CompanyRole = 'owner' | 'admin' | 'worker' | 'customer';
export type MemberStatus = 'active' | 'invited' | 'inactive';

export interface CompanyMember {
  id: string;
  companyId: string;
  personId: string;
  role: CompanyRole;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
  person?: PersonSummary;
}

export interface PersonSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
}

export interface Person {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}
