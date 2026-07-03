import type { EmployeeRole, Permission } from "./types";

const ROLE_MATRIX: Record<EmployeeRole, Permission[]> = {
  admin: [
    "settings.read","settings.write","employees.read","employees.write",
    "finance.read","finance.write","orders.read","orders.write",
    "menu.read","menu.write","delivery.read","delivery.write",
    "marketing.read","marketing.write","audit.read","features.write",
  ],
  manager: [
    "settings.read","settings.write","employees.read",
    "finance.read","orders.read","orders.write",
    "menu.read","menu.write","delivery.read","delivery.write",
    "marketing.read","marketing.write","audit.read",
  ],
  finance: ["settings.read","finance.read","finance.write","orders.read","audit.read"],
  operations: ["settings.read","orders.read","orders.write","delivery.read","delivery.write","menu.read"],
  marketing: ["settings.read","marketing.read","marketing.write","menu.read"],
  attendant: ["orders.read","orders.write","menu.read","delivery.read"],
  viewer: ["settings.read","orders.read","menu.read","delivery.read","finance.read","marketing.read","audit.read"],
};

export const PermissionRegistry = {
  for(role: EmployeeRole): Permission[] {
    return ROLE_MATRIX[role] ?? [];
  },
  can(role: EmployeeRole, permission: Permission): boolean {
    return PermissionRegistry.for(role).includes(permission);
  },
  requireAny(role: EmployeeRole, permissions: Permission[]): boolean {
    return permissions.some((p) => PermissionRegistry.can(role, p));
  },
} as const;
