export type TruckStatus = 'available' | 'assigned' | 'maintenance' | 'out_of_service';

export interface Truck {
  id: string;
  companyId: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  vin?: string;
  color?: string;
  status: TruckStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  assigneeName?: string;
}

export interface DailyTruckAssignment {
  id: string;
  companyId: string;
  truckId: string;
  personId: string;
  assignedDate: string;
  createdAt: string;
}
