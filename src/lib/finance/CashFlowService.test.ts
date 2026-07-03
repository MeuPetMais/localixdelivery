import { describe, it, expect, beforeEach } from "vitest";
import {
  CashFlowService, ReceivablesService, PayablesService, FinancialProjectionService,
} from "./CashFlowService";

const today = new Date().toISOString().slice(0, 10);
const in5 = (() => { const d = new Date(); d.setDate(d.getDate() + 5); return d.toISOString().slice(0, 10); })();
const in20 = (() => { const d = new Date(); d.setDate(d.getDate() + 20); return d.toISOString().slice(0, 10); })();
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

const ledger = {
  async getStatement() {
    return [
      { transaction_type: "RESTAURANT_RECEIVABLE", amount: 100, status: "COMPLETED", created_at: `${today}T10:00:00Z` },
      { transaction_type: "PLATFORM_FEE", amount: -5, status: "COMPLETED", created_at: `${today}T10:05:00Z` },
      { transaction_type: "RESTAURANT_RECEIVABLE", amount: 50, status: "PENDING", created_at: `${today}T11:00:00Z` },
    ];
  },
  async getBalance() { return { balance: 200, currency: "BRL" }; },
};

const receivablesPort = {
  async list() {
    return [
      { id: "1", restaurant_id: "r", order_id: null, payment_id: null, gateway: null, gross_amount: 60, net_amount: 55, currency: "BRL", expected_date: in5, received_date: null, status: "PENDING" as const, metadata: {}, created_at: today, updated_at: today },
      { id: "2", restaurant_id: "r", order_id: null, payment_id: null, gateway: null, gross_amount: 40, net_amount: 38, currency: "BRL", expected_date: in20, received_date: null, status: "PENDING" as const, metadata: {}, created_at: today, updated_at: today },
      { id: "3", restaurant_id: "r", order_id: null, payment_id: null, gateway: null, gross_amount: 30, net_amount: 27, currency: "BRL", expected_date: yesterday, received_date: null, status: "PENDING" as const, metadata: {}, created_at: today, updated_at: today },
      { id: "4", restaurant_id: "r", order_id: null, payment_id: null, gateway: null, gross_amount: 100, net_amount: 95, currency: "BRL", expected_date: yesterday, received_date: yesterday, status: "RECEIVED" as const, metadata: {}, created_at: today, updated_at: today },
    ];
  },
};

const payablesPort = {
  async list() {
    return [
      { id: "p1", restaurant_id: "r", supplier_id: null, description: "Aluguel", category: "fixed", amount: 500, paid_amount: 0, currency: "BRL", status: "OPEN" as const, due_date: in5, paid_date: null, metadata: {}, created_at: today, updated_at: today },
      { id: "p2", restaurant_id: "r", supplier_id: null, description: "Fornecedor", category: "supplies", amount: 200, paid_amount: 0, currency: "BRL", status: "OVERDUE" as const, due_date: yesterday, paid_date: null, metadata: {}, created_at: today, updated_at: today },
      { id: "p3", restaurant_id: "r", supplier_id: null, description: "Pago", category: "fixed", amount: 100, paid_amount: 100, currency: "BRL", status: "PAID" as const, due_date: yesterday, paid_date: yesterday, metadata: {}, created_at: today, updated_at: today },
    ];
  },
};

describe("CashFlowService", () => {
  it("consolidates period inflow, outflow, and today buckets", async () => {
    const s = new CashFlowService({ ledger, receivables: receivablesPort, payables: payablesPort });
    const r = await s.getSummary({ restaurantId: "r", from: today, to: today });
    expect(r.period.inflow).toBe(100);
    expect(r.period.outflow).toBe(5);
    expect(r.period.net).toBe(95);
    expect(r.today.inflow).toBe(100);
    expect(r.today.outflow).toBe(5);
    expect(r.balance).toBe(200);
    expect(r.timeline.length).toBeGreaterThan(0);
  });
});

describe("ReceivablesService", () => {
  it("splits pending/overdue/received and next windows", async () => {
    const s = new ReceivablesService({ receivables: receivablesPort });
    const r = await s.getSummary({ restaurantId: "r", from: today, to: today });
    expect(r.received).toBe(95);
    expect(r.pending).toBe(55 + 38 + 27);
    expect(r.overdue).toBe(27);
    expect(r.next7).toBe(55);
    expect(r.next30).toBe(55 + 38);
    expect(r.items).toHaveLength(4);
  });
});

describe("PayablesService", () => {
  it("splits open/overdue/paid and next windows", async () => {
    const s = new PayablesService({ payables: payablesPort });
    const r = await s.getSummary({ restaurantId: "r", from: today, to: today });
    expect(r.paid).toBe(100);
    expect(r.open).toBe(500 + 200);
    expect(r.overdue).toBe(200);
    expect(r.next7).toBe(500);
    expect(r.items).toHaveLength(3);
  });
});

describe("FinancialProjectionService", () => {
  it("projects 7 and 30 day horizons", async () => {
    const cf = new CashFlowService({ ledger, receivables: receivablesPort, payables: payablesPort });
    const rs = new ReceivablesService({ receivables: receivablesPort });
    const ps = new PayablesService({ payables: payablesPort });
    const svc = new FinancialProjectionService(cf, rs, ps);
    const p7 = await svc.project({ restaurantId: "r", from: today, to: today, horizonDays: 7 });
    expect(p7.projectedInflow).toBe(55);
    expect(p7.projectedOutflow).toBe(500);
    expect(p7.projectedBalance).toBe(200 + 55 - 500);
    const p30 = await svc.project({ restaurantId: "r", from: today, to: today, horizonDays: 30 });
    expect(p30.projectedInflow).toBe(55 + 38);
    expect(p30.workingCapital).toBe((55 + 38 + 27) - (500 + 200));
  });
});
