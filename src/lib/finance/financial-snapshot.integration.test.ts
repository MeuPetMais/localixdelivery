import { describe, expect, it, vi } from "vitest";
import { FinancialDashboardService, type LedgerPort } from "./FinancialDashboardService";
import { CashFlowService } from "./CashFlowService";
import { computeBalance, type LedgerEntry } from "@/lib/ledger/LedgerService";
import { dashboardBalance } from "./dashboard-balance";

const now = "2026-11-11T12:00:00Z";
function row(
  id: string,
  amount: number,
  transaction_type: LedgerEntry["transaction_type"] = "PAYMENT_APPROVED",
): LedgerEntry {
  return {
    id,
    order_id: "same-order",
    restaurant_id: "restaurant",
    provider: "synthetic",
    customer_id: null,
    transaction_type,
    amount,
    currency: "BRL",
    status: "COMPLETED",
    reference_type: "synthetic-payment",
    reference_id: id,
    description: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
}
function snapshotPort(entries: LedgerEntry[]) {
  const port: LedgerPort = {
    getStatement: vi.fn(async () => {
      throw new Error("separate statement read forbidden");
    }),
    getBalance: vi.fn(async () => {
      throw new Error("separate balance read forbidden");
    }),
    getSnapshot: vi.fn(async () => {
      const copy = structuredClone(entries);
      const balance = dashboardBalance(computeBalance(copy, "restaurant"));
      // A backfilled webhook arrives after the database returned its scalar response.
      entries.unshift(row("later-backfill", 100));
      return { rows: copy, balance };
    }),
  };
  return port;
}
describe("single-snapshot dashboard and cash flow", () => {
  it("keeps partial payments in one order and prevents later inserts changing only the balance", async () => {
    const entries = [
      row("payment-one", 30),
      row("payment-two", 20),
      row("fee", 1.49, "PLATFORM_FEE"),
    ];
    const ledger = snapshotPort(entries);
    const result = await new FinancialDashboardService({ ledger }).getExecutiveKPIs({
      restaurantId: "restaurant",
    });
    expect(result).toMatchObject({
      orders: 1,
      grossRevenue: 50,
      netRevenue: 48.51,
      currentBalance: 48.51,
      averageTicket: 50,
    });
    expect(ledger.getSnapshot).toHaveBeenCalledTimes(1);
    expect(ledger.getStatement).not.toHaveBeenCalled();
    expect(ledger.getBalance).not.toHaveBeenCalled();
  });
  it("derives cash-flow timeline and balance from exactly the same read", async () => {
    const ledger = snapshotPort([
      row("payment", 50),
      row("fee", 1.49, "PLATFORM_FEE"),
      row("refund-partial", 10, "REFUND"),
      row("payout-partial", 5, "PAYOUT"),
      row("chargeback-partial", 5, "CHARGEBACK"),
    ]);
    const service = new CashFlowService({
      ledger,
      receivables: { list: async () => [] },
      payables: { list: async () => [] },
    });
    const result = await service.getSummary({ restaurantId: "restaurant", from: now, to: now });
    expect(result.balance).toBe(28.51);
    expect(result.period.net).toBeCloseTo(28.51);
    expect(ledger.getSnapshot).toHaveBeenCalledTimes(1);
    expect(ledger.getStatement).not.toHaveBeenCalled();
  });
  it("keeps mixed bases blocked, including after an attempted snapshot read", async () => {
    const ledger = snapshotPort([
      row("payment", 50),
      row("receivable", 48.51, "RESTAURANT_RECEIVABLE"),
      row("fee", 1.49, "PLATFORM_FEE"),
    ]);
    await expect(
      new FinancialDashboardService({ ledger }).getExecutiveKPIs({ restaurantId: "restaurant" }),
    ).rejects.toThrow("Saldo indisponível");
  });
  it("propagates RPC/connection failures without falling back to independent reads", async () => {
    const ledger = snapshotPort([]);
    ledger.getSnapshot = vi.fn(async () => {
      throw new Error("RPC missing or database disconnected");
    });
    await expect(
      new FinancialDashboardService({ ledger }).getExecutiveKPIs({ restaurantId: "restaurant" }),
    ).rejects.toThrow("RPC missing");
    expect(ledger.getStatement).not.toHaveBeenCalled();
    expect(ledger.getBalance).not.toHaveBeenCalled();
  });
});
