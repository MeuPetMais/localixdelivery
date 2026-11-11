import { describe, expect, it } from "vitest";
import { computeBalance, type LedgerEntry } from "@/lib/ledger/LedgerService";
import { dashboardBalance } from "./dashboard-balance";
import { FinancialDashboardService } from "./FinancialDashboardService";
function row(
  transaction_type: LedgerEntry["transaction_type"],
  amount: number,
  status: LedgerEntry["status"] = "COMPLETED",
): LedgerEntry {
  return {
    id: crypto.randomUUID(),
    order_id: "order",
    restaurant_id: "restaurant",
    customer_id: null,
    provider: "mercadopago",
    transaction_type,
    reference_type: null,
    reference_id: null,
    amount,
    currency: "BRL",
    status,
    description: null,
    metadata: {},
    created_at: "2026-11-09T15:00:00Z",
    updated_at: "2026-11-09T15:00:00Z",
  };
}
function service(rows: LedgerEntry[]) {
  return new FinancialDashboardService({
    ledger: {
      getStatement: async () => rows,
      getBalance: async () => dashboardBalance(computeBalance(rows, "restaurant")),
    },
  });
}
describe("Ledger to dashboard accounting safety", () => {
  it("reproduces 97.02 duplication and blocks both KPI and status exposure", async () => {
    const rows = [
      row("PAYMENT_APPROVED", 50),
      row("PLATFORM_FEE", 1.49),
      row("RESTAURANT_RECEIVABLE", 48.51),
    ];
    const before = structuredClone(rows);
    expect(computeBalance(rows, "restaurant").netBalance).toBe(97.02);
    await expect(service(rows).getExecutiveKPIs({ restaurantId: "restaurant" })).rejects.toThrow(
      "conciliação",
    );
    await expect(service(rows).getStatus({ restaurantId: "restaurant" })).rejects.toThrow(
      "conciliação",
    );
    expect(rows).toEqual(before);
  });
  it("preserves established gross payment minus fee semantics", async () => {
    const rows = [row("PAYMENT_APPROVED", 50), row("PLATFORM_FEE", 1.49)];
    const result = await service(rows).getExecutiveKPIs({ restaurantId: "restaurant" });
    expect(result).toMatchObject({
      grossRevenue: 50,
      netRevenue: 48.51,
      currentBalance: 48.51,
      orders: 1,
    });
  });
  it("does not mistake failed payments or another tenant for mixed posting bases", () => {
    const rows = [
      row("RESTAURANT_RECEIVABLE", 48.51),
      row("PAYMENT_APPROVED", 50, "FAILED"),
      { ...row("PAYMENT_APPROVED", 50), restaurant_id: "other" },
    ];
    expect(dashboardBalance(computeBalance(rows, "restaurant")).balance).toBe(48.51);
  });
  it("fails closed even when mixed entries have missing order links or belong to distinct orders", () => {
    const rows = [
      { ...row("PAYMENT_APPROVED", 50), order_id: null },
      { ...row("RESTAURANT_RECEIVABLE", 48.51), order_id: "other" },
    ];
    expect(() => dashboardBalance(computeBalance(rows, "restaurant"))).toThrow(
      "Saldo indisponível",
    );
  });
});
