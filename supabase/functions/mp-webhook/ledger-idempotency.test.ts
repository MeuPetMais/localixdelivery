import { describe, expect, it } from "vitest";
import {
  ledgerIdempotencyKey,
  recordMercadoPagoLedger,
  shouldDeduplicateLedgerType,
} from "./ledger-idempotency";

type LedgerEntry = Parameters<typeof recordMercadoPagoLedger>[1];

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    order_id: "order-1",
    restaurant_id: "restaurant-1",
    provider: "mercado_pago",
    transaction_type: "REFUND",
    amount: 5.99,
    currency: "BRL",
    status: "COMPLETED",
    reference_type: "mp_refund",
    reference_id: "175142020516:refund:678",
    description: "Estorno",
    metadata: { correlation_id: "mp:event", payment_id: "175142020516", refund_id: "678" },
    ...overrides,
  };
}

function makeSupabaseMock() {
  const rows: LedgerEntry[] = [];
  const query = {
    filters: [] as Array<{ column: keyof LedgerEntry; value: string }>,
    select: () => query,
    eq: (column: keyof LedgerEntry, value: string) => {
      query.filters.push({ column, value });
      return query;
    },
    limit: () => query,
    maybeSingle: async () => {
      const found = rows.find((row) =>
        query.filters.every((filter) => row[filter.column] === filter.value),
      );
      query.filters = [];
      return { data: found ? { id: "existing" } : null, error: null };
    },
    insert: async (row: LedgerEntry) => {
      rows.push(row);
      return { error: null };
    },
  };
  return {
    rows,
    client: {
      from: (table: string) => {
        expect(table).toBe("financial_ledger");
        return query;
      },
    },
  };
}

describe("Mercado Pago ledger idempotency", () => {
  it("deduplica REFUND por reference_type/reference_id/tipo", async () => {
    const db = makeSupabaseMock();
    expect(shouldDeduplicateLedgerType("REFUND")).toBe(true);

    await recordMercadoPagoLedger(db.client, entry());
    await recordMercadoPagoLedger(db.client, entry({ metadata: { correlation_id: "mp:other" } }));

    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]?.metadata.ledger_idempotency_key).toBe(
      "mp_refund:175142020516:refund:678:REFUND",
    );
  });

  it("permite refunds distintos do mesmo payment quando refund_id muda", async () => {
    const db = makeSupabaseMock();

    await recordMercadoPagoLedger(db.client, entry({ reference_id: "175142020516:refund:678" }));
    await recordMercadoPagoLedger(db.client, entry({ reference_id: "175142020516:refund:679" }));

    expect(db.rows).toHaveLength(2);
  });

  it("trata conflito de unicidade como retry idempotente", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: async () => ({ error: { code: "23505", message: "duplicate key" } }),
      }),
    };

    await expect(recordMercadoPagoLedger(client, entry())).resolves.toEqual({ inserted: false });
  });

  it("gera chave de idempotencia estavel", () => {
    expect(ledgerIdempotencyKey(entry())).toBe("mp_refund:175142020516:refund:678:REFUND");
  });
});
