// Reports & Executive Intelligence — unit tests.
import { describe, expect, it } from "vitest";
import { ExportEngine } from "./ExportEngine";
import { ScheduleEngine } from "./ScheduleEngine";
import { ReportEngine } from "./ReportEngine";
import type { ReportResult } from "./types";
import type { FinancialDashboardService } from "../FinancialDashboardService";
import type { CashFlowService, PayablesService, ReceivablesService } from "../CashFlowService";

const stubDashboard = {
  async getExecutiveKPIs() {
    return {
      grossRevenue: 1000, netRevenue: 900, grossProfit: 500, netProfit: 300,
      cmv: 400, marginPct: 33.33, orders: 10, averageTicket: 90,
      currentBalance: 1500, pendingReceivables: 200, pendingPayables: 100, currency: "BRL",
    };
  },
  async getStatus() { return { balance: 0, currency: "BRL" }; },
} as unknown as FinancialDashboardService;

const stubCashflow = {
  async getSummary() {
    return {
      balance: 500, currency: "BRL",
      today: { inflow: 100, outflow: 20 },
      period: { inflow: 500, outflow: 200, net: 300 },
      timeline: [{ date: "2026-07-01", inflow: 100, outflow: 20, net: 80, runningBalance: 580 }],
    };
  },
} as unknown as CashFlowService;

const stubReceivables = {
  async getSummary() {
    return { pending: 200, overdue: 50, received: 400, next7: 100, next30: 150, items: [] };
  },
} as unknown as ReceivablesService;

const stubPayables = {
  async getSummary() {
    return { open: 300, overdue: 100, paid: 500, next7: 200, next30: 250, items: [] };
  },
} as unknown as PayablesService;

const engine = new ReportEngine({
  dashboard: stubDashboard,
  cashflow: stubCashflow,
  receivables: stubReceivables,
  payables: stubPayables,
});

describe("ReportEngine", () => {
  it("builds cashflow report from CashFlowService", async () => {
    const r = await engine.build({ restaurantId: "r1", type: "cashflow" });
    expect(r.type).toBe("cashflow");
    expect(r.rows.length).toBe(1);
    expect(r.totals?.net).toBe(300);
  });

  it("builds executive summary from dashboard KPIs", async () => {
    const r = await engine.build({ restaurantId: "r1", type: "executive_ceo" });
    expect(r.columns).toEqual(["metric", "value"]);
    expect(r.rows.find(x => x.metric === "Receita líquida")?.value).toBe(900);
  });

  it("returns comparative delta between periods", async () => {
    const c = await engine.compare({ restaurantId: "r1", type: "executive_finance" });
    expect(c.current).toBe(900);
    expect(c.previous).toBe(900);
    expect(c.deltaPct).toBe(0);
  });
});

describe("ExportEngine", () => {
  const exporter = new ExportEngine();
  const sample: ReportResult = {
    type: "cashflow", title: "Fluxo", generatedAt: new Date().toISOString(), filters: {},
    columns: ["a", "b"], rows: [{ a: 1, b: "x,y" }, { a: 2, b: 'q"z' }],
  };

  it("csv escapes quotes and commas", () => {
    const p = exporter.export(sample, "csv");
    expect(p.mimeType).toContain("csv");
    expect(p.content).toContain('"x,y"');
    expect(p.content).toContain('"q""z"');
  });

  it("json is round-trippable", () => {
    const p = exporter.export(sample, "json");
    expect(JSON.parse(p.content).type).toBe("cashflow");
  });

  it("pdf falls back to printable html", () => {
    const p = exporter.export(sample, "pdf");
    expect(p.mimeType).toContain("html");
    expect(p.content).toContain("<table>");
  });
});

describe("ScheduleEngine", () => {
  const base = new Date("2026-07-03T12:00:00Z");
  it("advances daily/weekly/monthly", () => {
    expect(ScheduleEngine.nextExecution("daily", base).getUTCDate()).toBe(4);
    expect(ScheduleEngine.nextExecution("weekly", base).getUTCDate()).toBe(10);
    expect(ScheduleEngine.nextExecution("monthly", base).getUTCMonth()).toBe(7);
  });
  it("detects due schedules", () => {
    expect(ScheduleEngine.isDue("2026-07-02T00:00:00Z", base)).toBe(true);
    expect(ScheduleEngine.isDue("2026-08-01T00:00:00Z", base)).toBe(false);
    expect(ScheduleEngine.isDue(null)).toBe(false);
  });
});
