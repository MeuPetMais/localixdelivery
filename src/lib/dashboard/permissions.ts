import type { DashboardRole, NavigationItem, WorkspaceDefinition } from "./types";

export const ROLE_HIERARCHY: Record<DashboardRole, number> = {
  ADMIN: 100,
  MANAGER: 80,
  ATTENDANT: 60,
  CASHIER: 50,
  KITCHEN: 40,
  DRIVER: 30,
};

export function canAccess(
  role: DashboardRole,
  required?: DashboardRole[],
): boolean {
  if (!required || required.length === 0) return true;
  return required.includes(role);
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
