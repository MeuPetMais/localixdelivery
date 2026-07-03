import { describe, it, expect } from "vitest";
import { FinancialDashboardService, type LedgerPort, type CostPort } from "./FinancialDashboardService";
import { FinancePermissions } from "./FinancePermissions";
import { normalizeFilters, resolvePeriod } from "./FinanceFilters";
import { FinanceWidgetRegistry } from "./FinanceWidgetRegistry";
import { FinanceAudit } from "./FinanceAudit";

const ledger: LedgerPort = {
  async getStatement() {
    return [
      { transaction_type: "RESTAURANT_RECEIVABLE", amount: 100, status: "COMPLETED", created_at: "2026-07-01" },
      { transaction_type: "RESTAURANT_RECEIVABLE", amount: 50, status: "COMPLETED", created_at: "2026-07-02" },
      { transaction_type: "PLATFORM_FEE", amount: -3, status: "COMPLETED", created_at: "2026-07-02" },
      { transaction_type: "GATEWAY_FEE", amount: -2, status: "COMPLETED", created_at: "2026-07-02" },
      { transaction_type: "RESTAURANT_RECEIVABLE", amount: 40, status: "PENDING", created_at: "2026-07-03" },
    ];
  },
  async getBalance() { return { balance: 145, currency: "BRL" }; },
};

const cost: CostPort = {
  async getPeriodProfitability() { return { cmv: 45, grossProfit: 100, netProfit: 90, marginPct: 60 }; },
};

describe("FinancialDashboardService", () => {
  it("consolidates KPIs from ledger + cost ports", async () => {
    const svc = new FinancialDashboardService({ ledger, cost });
    const k = await svc.getExecutiveKPIs({ restaurantId: "r1" });
    expect(k.grossRevenue).toBe(150);
    expect(k.netRevenue).toBe(145); // 150 - 5
    expect(k.orders).toBe(2);
    expect(k.averageTicket).toBe(75);
    expect(k.cmv).toBe(45);
    expect(k.netProfit).toBe(90);
    expect(k.currentBalance).toBe(145);
    expect(k.pendingReceivables).toBe(40);
    expect(k.currency).toBe("BRL");
  });

  it("falls back when cost port absent", async () => {
    const svc = new FinancialDashboardService({ ledger });
    const k = await svc.getExecutiveKPIs({ restaurantId: "r1" });
    expect(k.cmv).toBe(0);
    expect(k.grossProfit).toBe(145);
  });

  it("returns status snapshot", async () => {
    const svc = new FinancialDashboardService({
      ledger,
      reconciliation: { async getLastReconciliation() { return { at: "2026-07-03T00:00:00Z", status: "MATCHED" }; } },
      split: { async getLastSplit() { return { at: "2026-07-02T00:00:00Z", status: "COMPLETED" }; } },
      payment: { async getActiveGateway() { return { provider: "mercado_pago" }; } },
    });
    const s = await svc.getStatus({ restaurantId: "r1" });
    expect(s.activeGateway).toBe("mercado_pago");
    expect(s.balance).toBe(145);
    expect(s.lastReconciliationAt).toBeDefined();
  });
});

describe("FinancePermissions", () => {
  it("grants full access to ADMIN and FINANCE", () => {
    expect(FinancePermissions.can("ADMIN", "dre")).toBe(true);
    expect(FinancePermissions.can("FINANCE", "reports")).toBe(true);
  });
  it("limits ACCOUNTANT and VIEWER", () => {
    expect(FinancePermissions.can("ACCOUNTANT", "receivables")).toBe(false);
    expect(FinancePermissions.can("VIEWER", "reports")).toBe(false);
    expect(FinancePermissions.can("VIEWER", "summary")).toBe(true);
  });
  it("controls export", () => {
    expect(FinancePermissions.canExport("ADMIN")).toBe(true);
    expect(FinancePermissions.canExport("VIEWER")).toBe(false);
  });
});

describe("FinanceFilters", () => {
  it("resolves periods deterministically", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const r = resolvePeriod("month", now);
    expect(r.from.startsWith("2026-07-01")).toBe(true);
  });
  it("normalizes custom range", () => {
    const f = normalizeFilters({ period: "custom", from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" });
    expect(f.period).toBe("custom");
    expect(f.from).toBe("2026-01-01T00:00:00Z");
  });
});

describe("FinanceWidgetRegistry", () => {
  it("registers and filters widgets by tab and role", () => {
    FinanceWidgetRegistry.clear();
    const Dummy = () => null;
    FinanceWidgetRegistry.register({ id: "a", title: "A", tab: "summary", component: Dummy });
    FinanceWidgetRegistry.register({ id: "b", title: "B", tab: "dre", requiredRoles: ["ADMIN"], component: Dummy });
    expect(FinanceWidgetRegistry.listByTab("summary", "VIEWER")).toHaveLength(1);
    expect(FinanceWidgetRegistry.listByTab("dre", "VIEWER")).toHaveLength(0);
    expect(FinanceWidgetRegistry.listByTab("dre", "ADMIN")).toHaveLength(1);
  });
});

describe("FinanceAudit", () => {
  it("emits to sinks", () => {
    const received: any[] = [];
    const off = FinanceAudit.subscribe(e => received.push(e));
    FinanceAudit.emit({ type: "TAB_CHANGE", restaurantId: "r1", payload: { tab: "dre" } });
    off();
    expect(received[0].type).toBe("TAB_CHANGE");
    expect(received[0].at).toBeDefined();
  });
});
