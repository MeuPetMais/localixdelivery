import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webhookSource = readFileSync(
  new URL("../../../supabase/functions/mp-webhook/index.ts", import.meta.url),
  "utf8",
);
const ledgerSource = readFileSync(
  new URL("../../../supabase/functions/mp-webhook/ledger-idempotency.ts", import.meta.url),
  "utf8",
);

describe("mp-webhook PAYMENT_FAILED idempotency", () => {
  it("routes rejected, cancelled and expired through the shared idempotent ledger helper", () => {
    expect(webhookSource).toContain(
      'local === "REJECTED" || local === "CANCELLED" || local === "EXPIRED"',
    );
    expect(webhookSource).toContain('transaction_type: "PAYMENT_FAILED"');
    expect(webhookSource).toContain("await recordMercadoPagoLedger(sb, {");
    expect(webhookSource).toContain("status_detail: mp.status_detail ?? null");
  });

  it("includes PAYMENT_FAILED in the shared deduplication set", () => {
    expect(ledgerSource).toContain('"PAYMENT_FAILED"');
    expect(ledgerSource).toContain("ledger_idempotency_key");
    expect(ledgerSource).toContain('error?.code === "23505"');
  });
});
