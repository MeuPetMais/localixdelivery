import type { AnalyticsScope } from "./types";

export type AnalyticsRole =
  | "owner" | "manager" | "finance" | "operations"
  | "marketing" | "viewer" | "platform_admin";

const MATRIX: Record<AnalyticsRole, AnalyticsScope[]> = {
  owner: ["restaurant", "operations", "financial", "customer", "product", "delivery", "inventory", "marketing", "executive"],
  manager: ["restaurant", "operations", "customer", "product", "delivery", "inventory"],
  finance: ["financial", "restaurant", "executive"],
  operations: ["operations", "delivery", "inventory"],
  marketing: ["marketing", "customer"],
  viewer: ["restaurant"],
  platform_admin: ["platform", "executive", "financial", "operations", "restaurant", "customer", "product", "delivery", "inventory", "marketing"],
};

export const AnalyticsPermissions = {
  can(role: AnalyticsRole, scope: AnalyticsScope): boolean {
    return MATRIX[role]?.includes(scope) ?? false;
  },
  scopesFor(role: AnalyticsRole): AnalyticsScope[] {
    return [...(MATRIX[role] ?? [])];
  },
};
