import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webhookSource = readFileSync(
  new URL("../../../supabase/functions/mp-webhook/index.ts", import.meta.url),
  "utf8",
);
const helperSource = readFileSync(
  new URL("../../../supabase/functions/mp-webhook/ledger-idempotency.ts", import.meta.url),
  "utf8",
);
const refundSource = readFileSync(
  new URL("../../../supabase/functions/mp-webhook/refund-ledger.ts", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL(
    "../../../supabase/migrations/20260822191319_mp_refund_ledger_idempotency.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("mp-webhook refund ledger idempotency", () => {
  it("webhook refunded registra REFUND por refund_id, nao por event_id", () => {
    expect(webhookSource).toContain("import { recordMercadoPagoLedger }");
    expect(webhookSource).toContain("recordPaymentRefunds(sb, mp");
    expect(webhookSource).toContain('if (local === "REFUNDED") {');
    expect(webhookSource).not.toContain("latestRefund");
    expect(webhookSource).not.toContain("refund:full:");
    expect(webhookSource).toContain("recordMercadoPagoLedger(sb");
  });

  it("helper compartilhado preserva apenas pagamentos positivos", () => {
    expect(helperSource).toContain('"PAYMENT_PENDING"');
    expect(helperSource).toContain('"PAYMENT_APPROVED"');
    expect(helperSource).not.toContain('"REFUND"');
    expect(helperSource).not.toContain('"CHARGEBACK"');
    expect(helperSource).not.toContain('.eq("provider", entry.provider)');
    expect(helperSource).toContain('.eq("reference_type", entry.reference_type)');
    expect(helperSource).toContain('.eq("reference_id", entry.reference_id)');
    expect(helperSource).toContain('.eq("transaction_type", entry.transaction_type)');
    expect(helperSource).toContain('error?.code === "23505"');
    expect(refundSource).toContain('.eq("provider", entry.provider)');
    expect(refundSource).toContain('error?.code === "23505"');
  });

  it("migration local adiciona protecao de unicidade contra corrida", () => {
    expect(migrationSource).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS financial_ledger_mp_idempotency_uidx",
    );
    expect(migrationSource).toContain("provider = 'mercado_pago'");
    expect(migrationSource).toContain(
      "transaction_type IN ('PAYMENT_PENDING', 'PAYMENT_APPROVED', 'REFUND', 'CHARGEBACK')",
    );
    expect(migrationSource).toContain("metadata ? 'ledger_idempotency_key'");
  });
});
