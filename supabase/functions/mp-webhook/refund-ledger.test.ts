import { describe, expect, it } from "vitest";
import { recordPaymentRefunds } from "./refund-ledger";

function database() {
  const rows: Array<Record<string, unknown>> = [];
  const filters: Array<[string, unknown]> = [];
  const queries: Array<Array<[string, unknown]>> = [];
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    },
    limit: () => query,
    maybeSingle: async () => {
      queries.push([...filters]);
      const row = rows.find((candidate) =>
        filters.every(([column, value]) => candidate[column] === value),
      );
      filters.length = 0;
      return { data: row ? { id: "existing" } : null, error: null };
    },
    insert: async (row: Record<string, unknown>) => {
      rows.push(row);
      return { error: null };
    },
  };
  return { rows, queries, client: { from: (_table: string) => query } };
}

const context = {
  orderId: "order-1",
  restaurantId: "restaurant-1",
  currency: "BRL",
  correlationId: "mp:event-a",
};

describe("refund ledger identity", () => {
  it("deduplicates the same refund across events", async () => {
    const db = database();
    const payment = { id: "payment-1", refunds: [{ id: "A", amount: 10 }] };
    await recordPaymentRefunds(db.client, payment, context);
    await recordPaymentRefunds(db.client, payment, { ...context, correlationId: "mp:event-b" });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]?.metadata).toMatchObject({
      ledger_idempotency_key: "mp_refund:payment-1:refund:A:REFUND",
    });
    expect(db.queries[0]).toEqual([
      ["provider", "mercado_pago"],
      ["reference_type", "mp_refund"],
      ["reference_id", "payment-1:refund:A"],
      ["transaction_type", "REFUND"],
    ]);
  });

  it("adds B after A and keeps equal amounts distinct", async () => {
    const db = database();
    const a = { id: "A", amount: 10 };
    const b = { id: "B", amount: 10 };
    await recordPaymentRefunds(db.client, { id: "payment-1", refunds: [a] }, context);
    await recordPaymentRefunds(db.client, { id: "payment-1", refunds: [a, b] }, context);
    expect(db.rows).toHaveLength(2);
    expect(db.rows.map((row) => row.reference_id)).toEqual([
      "payment-1:refund:A",
      "payment-1:refund:B",
    ]);
    expect(db.rows.map((row) => row.amount)).toEqual([10, 10]);
    await recordPaymentRefunds(db.client, { id: "payment-1", refunds: [b, a] }, context);
    expect(db.rows).toHaveLength(2);
  });

  it("skips refunds without ID or amount and reports incompleteness", async () => {
    const db = database();
    const result = await recordPaymentRefunds(
      db.client,
      {
        id: "payment-1",
        refunds: [{ amount: 10 }, { id: "A", amount: 5 }, { id: "B" }],
      },
      context,
    );
    expect(result).toEqual({ recorded: 1, incomplete: 2 });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]?.reference_id).toBe("payment-1:refund:A");
  });

  it("treats a concurrent unique conflict as idempotent success", async () => {
    const rows: Array<Record<string, unknown>> = [];
    const query = {
      select: () => query,
      eq: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
      insert: async (row: Record<string, unknown>) => {
        if (rows.length) return { error: { code: "23505", message: "duplicate key" } };
        rows.push(row);
        return { error: null };
      },
    };
    const client = { from: (_table: string) => query };
    const payment = { id: "payment-1", refunds: [{ id: "A", amount: 10 }] };
    const results = await Promise.all([
      recordPaymentRefunds(client, payment, context),
      recordPaymentRefunds(client, payment, { ...context, correlationId: "mp:event-b" }),
    ]);
    expect(results).toEqual([
      { recorded: 1, incomplete: 0 },
      { recorded: 1, incomplete: 0 },
    ]);
    expect(rows).toHaveLength(1);
  });
});
