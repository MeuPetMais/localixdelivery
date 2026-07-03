import { describe, it, expect, beforeEach } from "vitest";
import {
  AnalyticsPlatform, DashboardBuilders, KpiCalculator, InsightsAggregator,
  AnalyticsExportService, AnalyticsPermissions, AnalyticsAudit, AnalyticsEventBus,
  DateRangeService, SnapshotStore,
} from "./index";
import type { AnalyticsFilter } from "./types";

const filter = (): AnalyticsFilter => ({
  restaurantId: "r1",
  range: DateRangeService.lastNDays(7),
});

beforeEach(() => {
  SnapshotStore.invalidate();
  AnalyticsAudit._reset();
  AnalyticsEventBus._reset();
});

describe("KpiCalculator", () => {
  it("computes delta and trend", () => {
    const k = KpiCalculator.build({ key: "x", label: "x", value: 120, previous: 100, scope: "executive" });
    expect(k.delta).toBe(20);
    expect(k.deltaPct).toBe(20);
    expect(k.trend).toBe("up");
  });
  it("handles zero previous", () => {
    const k = KpiCalculator.build({ key: "x", label: "x", value: 10, previous: 0, scope: "executive" });
    expect(k.deltaPct).toBe(100);
  });
  it("safeDiv avoids NaN", () => {
    expect(KpiCalculator.safeDiv(10, 0)).toBe(0);
  });
});

describe("DateRangeService", () => {
  it("computes comparison ranges", () => {
    const r = DateRangeService.lastNDays(7);
    const c = DateRangeService.compareRange(r, "week_vs_week");
    expect(new Date(c.from).getTime()).toBeLessThan(new Date(r.from).getTime());
  });
});

describe("DashboardBuilders", () => {
  it("builds executive section with derived avg ticket", () => {
    const s = DashboardBuilders.executive({
      revenue: 1000, profit: 200, gmv: 1200, orders: 10,
      activeCustomers: 5, recurringCustomers: 3,
    });
    const avg = s.kpis.find(k => k.key === "avg_ticket");
    expect(avg?.value).toBe(100);
  });
  it("builds all domain sections", () => {
    expect(DashboardBuilders.operational({ orders: 10, delivered: 8, avgPrepMin: 5, avgDeliveryMin: 20, slaPct: 90 }).kpis.length).toBeGreaterThan(0);
    expect(DashboardBuilders.financial({ revenue: 100, cmv: 40, margin: 60, receivables: 10, payables: 5 }).kpis.length).toBeGreaterThan(0);
    expect(DashboardBuilders.customer({ total: 10, active: 5, recurring: 3, ltv: 200, cac: 50 }).kpis.length).toBeGreaterThan(0);
    expect(DashboardBuilders.product({ topSelling: [{ id: "p1", qty: 10 }], topProfitable: [{ id: "p1", profit: 50 }] }).kpis.length).toBe(2);
    expect(DashboardBuilders.delivery({ delivered: 10, avgTimeMin: 30, onTimePct: 95, incidents: 1 }).kpis.length).toBe(4);
    expect(DashboardBuilders.inventory({ skus: 100, lowStock: 5, outOfStock: 2, wastePct: 3 }).kpis.length).toBe(4);
    expect(DashboardBuilders.platform({ tenants: 100, activeTenants: 80, gmv: 5000, mrr: 3000, conversionPct: 40 }).kpis.length).toBe(5);
  });
});

describe("InsightsAggregator", () => {
  it("ranks by severity", () => {
    const list = [
      InsightsAggregator.fromRaw({ source: "customer", severity: "info", title: "a", scope: "customer" }),
      InsightsAggregator.fromRaw({ source: "finance", severity: "critical", title: "b", scope: "financial" }),
    ];
    expect(InsightsAggregator.rank(list)[0].severity).toBe("critical");
  });
});

describe("AnalyticsExportService", () => {
  it("exports csv with kpis", () => {
    const snap = {
      scope: "executive" as const, restaurantId: "r1",
      generatedAt: new Date().toISOString(), filter: filter(),
      sections: [DashboardBuilders.executive({ revenue: 100, profit: 20, gmv: 120, orders: 10, activeCustomers: 5, recurringCustomers: 3 })],
    };
    const out = AnalyticsExportService.export(snap, "csv");
    expect(out.mimeType).toBe("text/csv");
    expect(out.content).toContain("GMV");
  });
  it("exports xlsx/pdf as base64", () => {
    const snap = {
      scope: "executive" as const, generatedAt: new Date().toISOString(), filter: filter(),
      sections: [],
    };
    const xlsx = AnalyticsExportService.export(snap, "xlsx");
    expect(xlsx.filename.endsWith(".xlsx")).toBe(true);
    const pdf = AnalyticsExportService.export(snap, "pdf");
    expect(pdf.mimeType).toBe("application/pdf");
  });
});

describe("AnalyticsPermissions", () => {
  it("finance role sees financial scope", () => {
    expect(AnalyticsPermissions.can("finance", "financial")).toBe(true);
    expect(AnalyticsPermissions.can("finance", "inventory")).toBe(false);
  });
  it("platform_admin sees platform scope", () => {
    expect(AnalyticsPermissions.can("platform_admin", "platform")).toBe(true);
  });
});

describe("AnalyticsPlatform facade", () => {
  it("generates dashboard, caches, and publishes events", async () => {
    const events: string[] = [];
    AnalyticsEventBus.subscribe(e => { events.push(e.type); });

    const snap = await AnalyticsPlatform.generateDashboard({
      scope: "executive", filter: filter(),
      sections: [DashboardBuilders.executive({
        revenue: 500, profit: 100, gmv: 600, orders: 5, activeCustomers: 3, recurringCustomers: 2,
      })],
      insights: [InsightsAggregator.fromRaw({ source: "customer", title: "top", scope: "customer" })],
    });

    expect(snap.sections.length).toBe(1);
    expect(events).toContain("DashboardGenerated");
    expect(events).toContain("SnapshotStored");
    expect(events).toContain("InsightPublished");

    const cached = await AnalyticsPlatform.generateDashboard({ scope: "executive", filter: filter() });
    expect(cached.generatedAt).toBe(snap.generatedAt);
  });

  it("invalidates cache on demand", async () => {
    await AnalyticsPlatform.generateDashboard({ scope: "operations", filter: filter(), sections: [] });
    AnalyticsPlatform.invalidate("operations", "r1");
    expect(SnapshotStore._size()).toBe(0);
  });

  it("exports snapshot via facade and records audit", () => {
    const snap = {
      scope: "financial" as const, restaurantId: "r1",
      generatedAt: new Date().toISOString(), filter: filter(),
      sections: [DashboardBuilders.financial({ revenue: 100, cmv: 40, margin: 60, receivables: 10, payables: 5 })],
    };
    const out = AnalyticsPlatform.export(snap, "csv");
    expect(out.content).toContain("Receita");
    expect(AnalyticsAudit.list({ action: "export" }).length).toBe(1);
  });
});
