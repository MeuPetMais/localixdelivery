import type { ConfigGroup, GroupPayload } from "@/lib/tenant/types";

export type EmployeeRole =
  | "admin"
  | "manager"
  | "finance"
  | "operations"
  | "marketing"
  | "attendant"
  | "viewer";

export const EMPLOYEE_ROLES: EmployeeRole[] = [
  "admin", "manager", "finance", "operations", "marketing", "attendant", "viewer",
];

export type Permission =
  | "settings.read" | "settings.write"
  | "employees.read" | "employees.write"
  | "finance.read" | "finance.write"
  | "orders.read" | "orders.write"
  | "menu.read" | "menu.write"
  | "delivery.read" | "delivery.write"
  | "marketing.read" | "marketing.write"
  | "audit.read"
  | "features.write";

export interface Employee {
  id: string;
  restaurant_id: string;
  user_id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  active: boolean;
  created_at?: string;
}

export interface AdminAuditEntry {
  id?: string;
  restaurant_id: string;
  group_name: ConfigGroup | "employees" | "features";
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_by?: string | null;
  source?: string | null;
  created_at?: string;
}

export type SettingsUpdate<G extends ConfigGroup> = {
  group: G;
  value: GroupPayload<G>;
  changedBy?: string;
};

export interface EmployeeRepository {
  list(restaurantId: string): Promise<Employee[]>;
  upsert(employee: Omit<Employee, "id" | "created_at"> & { id?: string }): Promise<Employee>;
  remove(restaurantId: string, employeeId: string): Promise<void>;
}

export interface AdminAuditRepository {
  list(restaurantId: string, limit?: number): Promise<AdminAuditEntry[]>;
  insert(entry: AdminAuditEntry): Promise<void>;
}
