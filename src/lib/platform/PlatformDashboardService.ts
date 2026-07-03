import { PlanCatalogService } from "./PlanCatalogService";
import type { RawOrderRow, RawTenantRow } from "./TenantAdministrationService";
import type { PlanTier } from "./types";

export interface PlatformDashboardSnapshot {
  restaurants: {
    total: number;
    active: number;
    suspended: number;
    trial: number;
    new_last_30d: number;
  };
  orders: {
    today: number;
    month: number;
    total: number;
  };
  finance: {
    gmv: number;
    platform_revenue: number;
    mrr: number;
    avg_ticket: number;
  };
  subscriptions: {
    by_plan: Record<PlanTier, number>;
    overdue: number;
    canceling: number;
  };
  conversion: {
    free_to_paid_rate: number;
  };
  ops: {
    avg_processing_seconds: number | null;
    critical_errors: number;
    status: "ok" | "degraded" | "down";
  };
}

export interface DashboardInput {
  tenants: RawTenantRow[];
  orders: (RawOrderRow & { status?: string | null })[];
  subscriptions?: Array<{ plan: PlanTier; overdue?: boolean; canceling?: boolean; monthly_price?: number }>;
  criticalErrors?: number;
  avgProcessingSeconds?: number | null;
}

const DAY = 24 * 60 * 60 * 1000;

export const PlatformDashboardService = {
  build(input: DashboardInput): PlatformDashboardSnapshot {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date(startToday.getFullYear(), startToday.getMonth(), 1);

    const tenants = input.tenants;
    const orders = input.orders;

    const totalT = tenants.length;
    const activeT = tenants.filter((t) => t.active !== false).length;
    const suspendedT = tenants.filter((t) => t.active === false || t.status === "suspended" || t.status === "blocked").length;
    const trialT = tenants.filter((t) => t.status === "trial").length;
    const newT = tenants.filter((t) => now - new Date(t.created_at).getTime() <= 30 * DAY).length;

    const gmv = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const ordersToday = orders.filter((o) => new Date(o.created_at).getTime() >= startToday.getTime()).length;
    const ordersMonth = orders.filter((o) => new Date(o.created_at).getTime() >= startMonth.getTime()).length;
    const avgTicket = orders.length ? gmv / orders.length : 0;

    let platformRevenue = 0;
    for (const t of tenants) {
      const def = PlanCatalogService.get(t.plan ?? "free");
      const own = orders.filter((o) => o.restaurant_id === t.id);
      const g = own.reduce((s, o) => s + Number(o.total ?? 0), 0);
      platformRevenue += g * def.commission_rate + own.length * def.fixed_fee;
    }

    const subs = input.subscriptions ?? [];
    const byPlan: Record<PlanTier, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
    let mrr = 0;
    for (const s of subs) {
      byPlan[s.plan] = (byPlan[s.plan] ?? 0) + 1;
      const price = s.monthly_price ?? PlanCatalogService.get(s.plan).monthly_price;
      mrr += price;
    }
    const overdue = subs.filter((s) => s.overdue).length;
    const canceling = subs.filter((s) => s.canceling).length;

    const paidCount = subs.filter((s) => s.plan !== "free").length;
    const totalSubs = subs.length || totalT || 1;
    const freeToPaid = paidCount / totalSubs;

    const criticalErrors = input.criticalErrors ?? 0;
    const status: PlatformDashboardSnapshot["ops"]["status"] =
      criticalErrors > 10 ? "down" : criticalErrors > 0 ? "degraded" : "ok";

    return {
      restaurants: {
        total: totalT,
        active: activeT,
        suspended: suspendedT,
        trial: trialT,
        new_last_30d: newT,
      },
      orders: {
        today: ordersToday,
        month: ordersMonth,
        total: orders.length,
      },
      finance: {
        gmv,
        platform_revenue: platformRevenue,
        mrr,
        avg_ticket: avgTicket,
      },
      subscriptions: {
        by_plan: byPlan,
        overdue,
        canceling,
      },
      conversion: {
        free_to_paid_rate: freeToPaid,
      },
      ops: {
        avg_processing_seconds: input.avgProcessingSeconds ?? null,
        critical_errors: criticalErrors,
        status,
      },
    };
  },
};
