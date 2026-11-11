import { describe, expect, it } from "vitest";
import { computeBalance, type LedgerEntry } from "@/lib/ledger/LedgerService";
import { dashboardBalance } from "@/lib/finance/dashboard-balance";

// Characterization / safety tests, NOT approval of a future accounting formula.
// See docs/GATE4_ACCOUNTING_CONTRACT_PROPOSAL.md and issue #90.
const REST_A = "11111111-1111-1111-1111-111111111111";
const REST_B = "22222222-2222-2222-2222-222222222222";
const ORDER_1 = "33333333-3333-3333-3333-333333333333";
const ORDER_2 = "44444444-4444-4444-4444-444444444444";

function entry(
  transaction_type: LedgerEntry["transaction_type"],
  amount: number,
  overrides: Partial<LedgerEntry> = {},
): LedgerEntry {
  return {
    id: crypto.randomUUID(),
    order_id: ORDER_1,
    restaurant_id: REST_A,
    customer_id: null,
    provider: "mercado_pago",
    transaction_type,
    reference_type: "synthetic_test",
    reference_id: crypto.randomUUID(),
    amount,
    currency: "BRL",
    status: "COMPLETED",
    description: null,
    metadata: {},
    created_at: "2026-11-11T00:00:00Z",
    updated_at: "2026-11-11T00:00:00Z",
    ...overrides,
  };
}

describe("Gate 4 - current Ledger accounting safety characterization", () => {
  it("retains the historical gross-minus-platform-fee arithmetic without claiming settlement", () => {
    const rows = [entry("PAYMENT_APPROVED", 50), entry("PLATFORM_FEE", 1.49)];
    expect(computeBalance(rows, REST_A).netBalance).toBe(48.51);
    expect(dashboardBalance(computeBalance(rows, REST_A)).balance).toBe(48.51);
  });

  it("reproduces the 97.02 double-base arithmetic but refuses to expose a dashboard balance", () => {
    const rows = [
      entry("PAYMENT_APPROVED", 50),
      entry("PLATFORM_FEE", 1.49),
      entry("RESTAURANT_RECEIVABLE", 48.51),
    ];
    const copy = structuredClone(rows);
    const summary = computeBalance(rows, REST_A);
    expect(summary.netBalance).toBe(97.02);
    expect(summary.ambiguousPostingBasis).toBe(true);
    expect(() => dashboardBalance(summary)).toThrow("conciliação contábil");
    expect(rows).toEqual(copy);
  });

  it("never combines different restaurant IDs into the same posting-basis warning", () => {
    const rows = [
      entry("PAYMENT_APPROVED", 50),
      entry("RESTAURANT_RECEIVABLE", 48.51, { restaurant_id: REST_B }),
    ];
    expect(computeBalance(rows, REST_A).ambiguousPostingBasis).toBe(false);
    expect(computeBalance(rows, REST_A).netBalance).toBe(50);
    expect(computeBalance(rows, REST_B).netBalance).toBe(48.51);
  });

  it("ignores non-completed posting types when evaluating balances and mixed bases", () => {
    const rows = [
      entry("PAYMENT_APPROVED", 50),
      entry("RESTAURANT_RECEIVABLE", 48.51, { status: "PENDING" }),
      entry("REFUND", 20, { status: "FAILED" }),
      entry("CHARGEBACK", 10, { status: "CANCELLED" }),
    ];
    const summary = computeBalance(rows, REST_A);
    expect(summary.netBalance).toBe(50);
    expect(summary.ambiguousPostingBasis).toBe(false);
  });

  it("characterizes refund and completed payout signs without asserting available cash", () => {
    const rows = [
      entry("PAYMENT_APPROVED", 50),
      entry("PLATFORM_FEE", 1.49),
      entry("REFUND", 10),
      entry("PAYOUT", 20),
    ];
    const summary = computeBalance(rows, REST_A);
    expect(summary.netBalance).toBe(18.51);
    expect(summary.refunds).toBe(10);
    expect(summary.payouts).toBe(20);
  });

  it("keeps the conservative block even when mixed bases belong to different orders", () => {
    const rows = [
      entry("PAYMENT_APPROVED", 50, { order_id: ORDER_1 }),
      entry("RESTAURANT_RECEIVABLE", 48.51, { order_id: ORDER_2 }),
    ];
    expect(computeBalance(rows, REST_A).ambiguousPostingBasis).toBe(true);
    expect(() => dashboardBalance(computeBalance(rows, REST_A))).toThrow("Saldo indisponível");
  });
});
