import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260918165000_harden_payment_failed_ledger_idempotency.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("PAYMENT_FAILED ledger idempotency migration", () => {
  it("extends both Mercado Pago idempotency indexes to PAYMENT_FAILED", () => {
    expect(migration).toContain("financial_ledger_mp_idempotency_uidx");
    expect(migration).toContain("financial_ledger_mp_payment_type_idempotency_uk");
    expect(migration).toContain("'PAYMENT_FAILED'");
    expect(migration).toContain("metadata ? 'ledger_idempotency_key'");
  });

  it("does not rewrite or delete historical financial rows", () => {
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.financial_ledger/i);
    expect(migration).not.toMatch(/UPDATE\s+public\.financial_ledger/i);
  });
});
