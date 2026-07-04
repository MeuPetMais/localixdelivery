import { normalizeRestaurantRole, type DashboardRole, type NavigationItem, type WorkspaceDefinition } from "./types";

export const ROLE_HIERARCHY: Record<DashboardRole, number> = {
  OWNER: 100,
  ADMIN: 100, // legacy alias for OWNER
  MANAGER: 80,
  STAFF: 60,
  ATTENDANT: 60, // legacy alias for STAFF
  CASHIER: 50,
  KITCHEN: 40,
  DELIVERY: 30,
  DRIVER: 30, // legacy alias for DELIVERY
};

export function canAccess(
  role: DashboardRole,
  required?: DashboardRole[],
): boolean {
  if (!required || required.length === 0) return true;
  // OWNER (and its legacy alias ADMIN) always have full access to the restaurant panel.
  const canonical = normalizeRestaurantRole(role);
  if (canonical === "OWNER") return true;
  const normalizedRequired = required.map(normalizeRestaurantRole);
  return normalizedRequired.includes(canonical);
}

export function filterNavigation(
  items: NavigationItem[],
  role: DashboardRole,
): NavigationItem[] {
  return items
    .filter((i) => canAccess(role, i.requiredRoles))
    .map((i) => ({
      ...i,
      children: i.children ? filterNavigation(i.children, role) : undefined,
    }));
}

export function filterWorkspaces(
  workspaces: WorkspaceDefinition[],
  role: DashboardRole,
): WorkspaceDefinition[] {
  return workspaces.filter((w) => canAccess(role, w.requiredRoles));
}
