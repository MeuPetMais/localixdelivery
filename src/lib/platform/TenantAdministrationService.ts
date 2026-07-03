import type { PlanTier, TenantStatus, TenantSummary, SubscriptionStatus } from "./types";
import { PlanCatalogService } from "./PlanCatalogService";

// Facade puro sobre os dados já entregues por `superadmin.functions.ts` /
// `admin.functions.ts`. Não abre conexões diretas com o banco; recebe as
// entradas cruas (typicamente já filtradas por RLS/service-role) e produz
// projeções determinísticas para o dashboard e a gestão de tenants.

export interface RawTenantRow {
  id: string;
  name: string;
  slug?: string | null;
  active?: boolean | null;
  is_open?: boolean | null;
  plan?: PlanTier | null;
  status?: TenantStatus | null;
  created_at: string;
}

export interface RawOrderRow {
  restaurant_id: string;
  total: number | null;
  created_at: string;
}

export const TenantAdministrationService = {
  resolveStatus(row: RawTenantRow): TenantStatus {
    if (row.status) return row.status;
    if (row.active === false) return "suspended";
    return "active";
  },

  buildSummary(row: RawTenantRow, orders: RawOrderRow[]): TenantSummary {
    const plan = row.plan ?? "free";
    const definition = PlanCatalogService.get(plan);
    const own = orders.filter((o) => o.restaurant_id === row.id);
    const gmv = own.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const commission = gmv * definition.commission_rate + own.length * definition.fixed_fee;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug ?? null,
      plan,
      status: this.resolveStatus(row),
      active: row.active !== false,
      is_open: Boolean(row.is_open),
      created_at: row.created_at,
      orders_total: own.length,
      gmv,
      commission,
    };
  },

  buildDirectory(rows: RawTenantRow[], orders: RawOrderRow[]): TenantSummary[] {
    return rows.map((r) => this.buildSummary(r, orders))
      .sort((a, b) => b.gmv - a.gmv);
  },

  filter(rows: TenantSummary[], query?: { search?: string; status?: TenantStatus; plan?: PlanTier }): TenantSummary[] {
    const term = query?.search?.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !`${r.name} ${r.slug ?? ""}`.toLowerCase().includes(term)) return false;
      if (query?.status && r.status !== query.status) return false;
      if (query?.plan && r.plan !== query.plan) return false;
      return true;
    });
  },
};

export const SubscriptionMonitorService = {
  // Deriva o status de assinatura a partir dos dados existentes de pagamento/tenant.
  // NÃO altera o Payment Domain — apenas projeta a informação para o painel.
  project(input: {
    tenantId: string;
    plan: PlanTier;
    nextBillingAt?: string | null;
    lastPaymentAt?: string | null;
    failures?: number;
    canceledAt?: string | null;
    trialEndsAt?: string | null;
  }): SubscriptionStatus {
    const now = Date.now();
    let status: SubscriptionStatus["status"] = "active";
    if (input.canceledAt) status = "canceled";
    else if (input.trialEndsAt && new Date(input.trialEndsAt).getTime() > now) status = "trialing";
    else if ((input.failures ?? 0) > 0) status = "past_due";
    return {
      tenant_id: input.tenantId,
      plan: input.plan,
      status,
      next_billing_at: input.nextBillingAt ?? null,
      last_payment_at: input.lastPaymentAt ?? null,
      failures: input.failures ?? 0,
    };
  },

  isOverdue(status: SubscriptionStatus, now = new Date()): boolean {
    if (status.status === "past_due") return true;
    if (!status.next_billing_at) return false;
    return new Date(status.next_billing_at).getTime() < now.getTime();
  },
};
