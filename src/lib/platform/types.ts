// Platform Administration Domain — types
// Escopo: administração global da plataforma Localix (não pertence a nenhum tenant).

export type PlatformRole =
  | "super_admin"
  | "platform_admin"
  | "finance_admin"
  | "support_admin"
  | "operations_admin"
  | "read_only";

export const PLATFORM_ROLES: PlatformRole[] = [
  "super_admin",
  "platform_admin",
  "finance_admin",
  "support_admin",
  "operations_admin",
  "read_only",
];

export type PlatformPermission =
  | "platform.dashboard.read"
  | "platform.tenants.read"
  | "platform.tenants.write"
  | "platform.tenants.suspend"
  | "platform.users.read"
  | "platform.users.write"
  | "platform.admins.read"
  | "platform.admins.write"
  | "platform.plans.read"
  | "platform.plans.write"
  | "platform.subscriptions.read"
  | "platform.subscriptions.write"
  | "platform.finance.read"
  | "platform.finance.write"
  | "platform.commissions.read"
  | "platform.commissions.write"
  | "platform.coupons.read"
  | "platform.coupons.write"
  | "platform.feature_flags.read"
  | "platform.feature_flags.write"
  | "platform.config.read"
  | "platform.config.write"
  | "platform.audit.read"
  | "platform.logs.read"
  | "platform.support.read"
  | "platform.support.write"
  | "platform.incidents.read"
  | "platform.moderation.read"
  | "platform.moderation.write"
  | "platform.notifications.read"
  | "platform.notifications.write"
  | "platform.monitoring.read";

export type PlanTier = "free" | "starter" | "pro" | "enterprise";

export interface PlanLimits {
  max_orders_per_month: number | null;
  max_products: number | null;
  max_employees: number | null;
  max_locations: number | null;
}

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  monthly_price: number;
  yearly_price: number;
  commission_rate: number;
  fixed_fee: number;
  limits: PlanLimits;
  features: string[];
  restrictions: string[];
}

export type TenantStatus = "active" | "suspended" | "blocked" | "trial" | "pending";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string | null;
  plan: PlanTier;
  status: TenantStatus;
  active: boolean;
  is_open: boolean;
  created_at: string;
  orders_total: number;
  gmv: number;
  commission: number;
}

export interface SubscriptionStatus {
  tenant_id: string;
  plan: PlanTier;
  status: "active" | "past_due" | "canceled" | "trialing";
  next_billing_at: string | null;
  last_payment_at: string | null;
  failures: number;
}

export type PlatformAuditAction =
  | "tenant.activated"
  | "tenant.suspended"
  | "tenant.blocked"
  | "tenant.reactivated"
  | "tenant.plan_changed"
  | "tenant.deleted"
  | "plan.updated"
  | "feature_flag.changed"
  | "admin.granted"
  | "admin.revoked"
  | "coupon.created"
  | "coupon.revoked"
  | "config.updated"
  | "moderation.action"
  | "support.ticket_assigned";

export interface PlatformAuditEntry {
  id?: string;
  actor_id: string;
  actor_role: PlatformRole;
  action: PlatformAuditAction;
  target_type: string;
  target_id: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export type PlatformDomainEvent =
  | { type: "PlatformTenantStatusChanged"; tenantId: string; from: TenantStatus; to: TenantStatus; actorId: string }
  | { type: "PlatformPlanChanged"; tenantId: string; from: PlanTier; to: PlanTier; actorId: string }
  | { type: "PlatformFeatureFlagChanged"; key: string; enabled: boolean; actorId: string }
  | { type: "PlatformAdminGranted"; userId: string; role: PlatformRole; actorId: string }
  | { type: "PlatformAdminRevoked"; userId: string; actorId: string }
  | { type: "PlatformIncidentReported"; incidentId: string; severity: "low" | "medium" | "high" | "critical" };
