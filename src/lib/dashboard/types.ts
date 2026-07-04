// Restaurant-scoped roles (RBAC v2).
// Canonical: OWNER | MANAGER | CASHIER | KITCHEN | DELIVERY | STAFF
// Legacy aliases kept for backward compatibility during migration:
//   ADMIN     → OWNER
//   ATTENDANT → STAFF
//   DRIVER    → DELIVERY
export type RestaurantRole =
  | "OWNER"
  | "MANAGER"
  | "CASHIER"
  | "KITCHEN"
  | "DELIVERY"
  | "STAFF";

export type LegacyRestaurantRole = "ADMIN" | "ATTENDANT" | "DRIVER";

export type DashboardRole = RestaurantRole | LegacyRestaurantRole;

/** Normalize legacy role aliases to canonical RBAC v2 roles. */
export function normalizeRestaurantRole(role: DashboardRole): RestaurantRole {
  switch (role) {
    case "ADMIN": return "OWNER";
    case "ATTENDANT": return "STAFF";
    case "DRIVER": return "DELIVERY";
    default: return role;
  }
}

export type WorkspaceId =
  | "operation"
  | "financial"
  | "products"
  | "customers"
  | "marketing"
  | "analytics"
  | "settings";

export interface WorkspaceDefinition {
  id: WorkspaceId;
  label: string;
  icon?: string;
  requiredRoles?: DashboardRole[];
}

export interface NavigationItem {
  id: string;
  label: string;
  to?: string;
  icon?: string;
  workspace?: WorkspaceId;
  requiredRoles?: DashboardRole[];
  children?: NavigationItem[];
}

export interface DashboardBranding {
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

export interface DashboardRestaurantStatus {
  isOpen: boolean;
  acceptingOrders: boolean;
  vacationMode: boolean;
  maintenanceMode: boolean;
  deliveryMode: "OWN" | "LOCALIX" | "HYBRID" | "OFF";
  scheduleLabel?: string;
}

export interface WidgetContext {
  restaurantId: string;
  role: DashboardRole;
  workspace: WorkspaceId;
}

export interface WidgetDefinition<TData = unknown> {
  id: string;
  title: string;
  description?: string;
  workspace: WorkspaceId;
  requiredRoles?: DashboardRole[];
  span?: 1 | 2 | 3 | 4;
  load: (ctx: WidgetContext) => Promise<TData>;
  render: (data: TData, ctx: WidgetContext) => React.ReactNode;
}

export interface DashboardAuditEvent {
  type:
    | "LOGIN"
    | "ACCESS"
    | "WORKSPACE_CHANGE"
    | "QUICK_ACTION"
    | "SEARCH"
    | "COMMAND";
  actorId?: string;
  restaurantId?: string;
  payload?: Record<string, unknown>;
  at: string;
}
