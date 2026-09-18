import { describe, expect, it } from "vitest";
import { recordChargebackLedger } from "./chargeback-ledger.ts";

function mockLedger() {
  const rows: Record<string, unknown>[] = [];

  const sb = {
    from(table: string) {
      if (table !== "financial_ledger") throw new Error("unexpected table");
      return {
        select() {
          const filters: Record<string, unknown> = {};
          const q = {
            eq(key: string, value: unknown) {
              filters[key] = value;
              return q;
            },
            limit() {
              return q;
            },
            async maybeSingle() {
              const found = rows.find(
                (row) =>
                  row.provider === filters.provider &&
                  row.reference_type === filters.reference_type &&
                  row.reference_id === filters.reference_id &&
                  row.transaction_type === filters.transaction_type,
              );
              return { data: found ? { id: "existing" } : null, error: null };
            },
          };
          return q;
        },
        async insert(value: Record<string, unknown>) {
          const exists = rows.some(
            (row) =>
              row.provider === value.provider &&
              row.reference_type === value.reference_type &&
              row.reference_id === value.reference_id &&
              row.transaction_type === value.transaction_type,
          );
          if (exists) return { error: { code: "23505" } };
          rows.push(value);
          return { error: null };
        },
      };
    },
  };

  return { sb, rows };
}

describe("recordChargebackLedger", () => {
  it("deduplicates the same chargeback case across distinct events", async () => {
    const { sb, rows } = mockLedger();
    const base = {
      orderId: "order-1",
      restaurantId: "restaurant-1",
      chargebackId: "case-123",
      paymentId: "payment-1",
      amount: 25.5,
      currency: "BRL",
    };

    await recordChargebackLedger(sb, { ...base, correlationId: "mp:event-a" });
    await recordChargebackLedger(sb, { ...base, correlationId: "mp:event-b" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reference_type: "mp_chargeback",
      reference_id: "case-123",
      transaction_type: "CHARGEBACK",
      amount: 25.5,
    });
    expect((rows[0].metadata as Record<string, unknown>).ledger_idempotency_key).toBe(
      "mp_chargeback:case-123:CHARGEBACK",
    );
  });

  it("keeps distinct chargeback cases separate even for the same payment", async () => {
    const { sb, rows } = mockLedger();
    const base = {
      orderId: "order-1",
      restaurantId: "restaurant-1",
      paymentId: "payment-1",
      amount: 10,
      currency: "BRL",
      correlationId: "mp:event",
    };

    await recordChargebackLedger(sb, { ...base, chargebackId: "case-A" });
    await recordChargebackLedger(sb, { ...base, chargebackId: "case-B" });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.reference_id)).toEqual(["case-A", "case-B"]);
  });
});
