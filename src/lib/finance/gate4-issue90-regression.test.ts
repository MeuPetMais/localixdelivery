import { describe, expect, it } from "vitest";
import { computeBalance, type LedgerEntry } from "@/lib/ledger/LedgerService";
import { dashboardBalance } from "@/lib/finance/dashboard-balance";

// Issue #90 — regression characterization, NOT a new accounting recognition rule.
// Never assert that netBalance represents bank cash or settled receivables.
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const O1 = "33333333-3333-3333-3333-333333333333";
const O2 = "44444444-4444-4444-4444-444444444444";

function e(
  id: string,
  type: LedgerEntry["transaction_type"],
  amount: number,
  extra: Partial<LedgerEntry> = {},
): LedgerEntry {
  return {
    id,
    order_id: O1,
    restaurant_id: A,
    customer_id: null,
    provider: "mercado_pago",
    transaction_type: type,
    reference_type: "synthetic",
    reference_id: id,
    amount,
    currency: "BRL",
    status: "COMPLETED",
    description: null,
    metadata: {},
    created_at: "2026-11-12T12:00:00Z",
    updated_at: "2026-11-12T12:00:00Z",
    ...extra,
  };
}

describe("Gate 4 / Issue #90 — accounting safety regression matrix", () => {
  it("FIN-01: mixed gross and receivable remain unavailable, never shown as available cash", () => {
    const rows = [
      e("capture", "PAYMENT_APPROVED", 50),
      e("receivable", "RESTAURANT_RECEIVABLE", 48.51),
      e("platform", "PLATFORM_FEE", 1.49),
    ];
    const summary = computeBalance(rows, A);
    expect(summary.netBalance).toBe(97.02); // diagnostic legacy arithmetic only
    expect(summary.ambiguousPostingBasis).toBe(true);
    expect(() => dashboardBalance(summary)).toThrow();
  });

  it("FIN-04: mixing economic bases across different orders still blocks the tenant", () => {
    const summary = computeBalance(
      [e("capture", "PAYMENT_APPROVED", 50), e("receivable", "RESTAURANT_RECEIVABLE", 48.51, { order_id: O2 })],
      A,
    );
    expect(summary.ambiguousPostingBasis).toBe(true);
    expect(() => dashboardBalance(summary)).toThrow();
  });

  it("FIN-10: tenant B does not inherit tenant A ambiguity", () => {
    const rows = [
      e("capture", "PAYMENT_APPROVED", 50),
      e("receivable", "RESTAURANT_RECEIVABLE", 48.51),
      e("other-capture", "PAYMENT_APPROVED", 20, { restaurant_id: B }),
    ];
    expect(computeBalance(rows, A).ambiguousPostingBasis).toBe(true);
    expect(computeBalance(rows, B).ambiguousPostingBasis).toBe(false);
    expect(computeBalance(rows, B).netBalance).toBe(20);
  });

  it("FIN-07/08/09: pending, failed and cancelled reversals never alter completed-only arithmetic", () => {
    const rows = [
      e("capture", "PAYMENT_APPROVED", 50),
      e("refund-pending", "REFUND", 10, { status: "PENDING" }),
      e("refund-failed", "REFUND", 10, { status: "FAILED" }),
      e("dispute-cancelled", "CHARGEBACK", 15, { status: "CANCELLED" }),
      e("payout-pending", "PAYOUT", 20, { status: "PENDING" }),
    ];
    expect(computeBalance(rows, A).netBalance).toBe(50);
  });

  it("FIN-06: duplicate economic references with different ledger IDs are NOT proven idempotent", () => {
    const rows = [
      e("event-one", "PAYMENT_APPROVED", 50, { reference_id: "same-provider-capture" }),
      e("event-two", "PAYMENT_APPROVED", 50, { reference_id: "same-provider-capture" }),
    ];
    // Characterization of an unresolved writer-level risk. This is NOT an approved balance.
    expect(computeBalance(rows, A).netBalance).toBe(100);
    expect(rows[0].reference_id).toBe(rows[1].reference_id);
  });
});
