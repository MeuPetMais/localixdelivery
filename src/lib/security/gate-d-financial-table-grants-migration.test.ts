import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260918223000_harden_critical_financial_table_grants.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Gate D critical financial table grant hardening", () => {
  it("removes anon access and authenticated writes from critical tables", () => {
    for (const table of [
      "financial_ledger",
      "order_payment",
      "order_pricing_snapshot",
      "payment_reconciliation",
      "payment_split",
      "payment_webhook_events",
      "customer_loyalty",
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("REVOKE ALL ON TABLE");
    expect(migration).toContain("FROM anon");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER");
    expect(migration).toContain("FROM authenticated");
  });

  it("removes default function EXECUTE from API roles", () => {
    expect(migration).toContain(
      "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
    );
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;",
    );
  });
});
