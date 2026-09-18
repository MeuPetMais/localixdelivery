import { describe, expect, it } from "vitest";
import {
  ledgerIdempotencyKey,
  recordMercadoPagoLedger,
  shouldDeduplicateLedgerType,
} from "./ledger-idempotency";

type LedgerEntry = Parameters<typeof recordMercadoPagoLedger>[1];

function entry(transactionType: "PAYMENT_PENDING" | "PAYMENT_APPROVED"): LedgerEntry {
  return {
    order_id: "order-1",
    restaurant_id: "restaurant-1",
    provider: "mercado_pago",
    transaction_type: transactionType,
    amount: 10,
    currency: "BRL",
    status: transactionType === "PAYMENT_PENDING" ? "PENDING" : "COMPLETED",
    reference_type: "mp_payment",
    reference_id: "payment-1",
    description: "Pagamento",
    metadata: { correlation_id: "mp:event-a" },
  };
}

function database() {
  const rows: LedgerEntry[] = [];
  const filters: Array<[string, string]> = [];
  const queries: Array<Array<[string, string]>> = [];
  const query = {
    select: () => query,
    eq: (column: string, value: string) => {
      filters.push([column, value]);
      return query;
    },
    limit: () => query,
    maybeSingle: async () => {
      queries.push([...filters]);
      const found = rows.find((row) =>
        filters.every(([column, value]) => row[column as keyof LedgerEntry] === value),
      );
      filters.length = 0;
      return { data: found ? { id: "existing" } : null, error: null };
    },
    insert: async (row: LedgerEntry) => {
      rows.push(row);
      return { error: null };
    },
  };
  return { rows, queries, client: { from: (_table: string) => query } };
}

describe("deployed payment ledger idempotency", () => {
  it.each(["PAYMENT_PENDING", "PAYMENT_APPROVED"] as const)(
    "%s retains the v13 lookup filters and deduplicates",
    async (transactionType) => {
      const db = database();
      const payment = entry(transactionType);
      expect(shouldDeduplicateLedgerType(transactionType)).toBe(true);

      await recordMercadoPagoLedger(db.client, payment);
      await recordMercadoPagoLedger(db.client, {
        ...payment,
        metadata: { correlation_id: "mp:event-b" },
      });

      expect(db.queries).toEqual([
        [
          ["reference_type", "mp_payment"],
          ["reference_id", "payment-1"],
          ["transaction_type", transactionType],
        ],
        [
          ["reference_type", "mp_payment"],
          ["reference_id", "payment-1"],
          ["transaction_type", transactionType],
        ],
      ]);
      expect(db.rows).toHaveLength(1);
      expect(db.rows[0]?.metadata.ledger_idempotency_key).toBe(
        `mp_payment:payment-1:${transactionType}`,
      );
    },
  );

  it("keeps REFUND outside the shared idempotency path", () => {
    expect(shouldDeduplicateLedgerType("REFUND")).toBe(false);
    expect(shouldDeduplicateLedgerType("CHARGEBACK")).toBe(false);
    expect(ledgerIdempotencyKey(entry("PAYMENT_APPROVED"))).toBe(
      "mp_payment:payment-1:PAYMENT_APPROVED",
    );
  });
});
