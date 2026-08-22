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
    expect(webhookSource).toContain("function latestRefund");
    expect(webhookSource).toContain("function refundLedgerReference");
    expect(webhookSource).toContain('referenceType: "mp_refund"');
    expect(webhookSource).toContain("refund_id: refundRef.refundId");
    expect(webhookSource).toContain('transaction_type: "REFUND"');
    expect(webhookSource).toContain("recordMercadoPagoLedger(sb");
  });

  it("helper deduplica REFUND e CHARGEBACK alem dos pagamentos positivos", () => {
    expect(helperSource).toContain('"PAYMENT_PENDING"');
    expect(helperSource).toContain('"PAYMENT_APPROVED"');
    expect(helperSource).toContain('"REFUND"');
    expect(helperSource).toContain('"CHARGEBACK"');
    expect(helperSource).toContain('.eq("provider", entry.provider)');
    expect(helperSource).toContain('.eq("reference_type", entry.reference_type)');
    expect(helperSource).toContain('.eq("reference_id", entry.reference_id)');
    expect(helperSource).toContain('.eq("transaction_type", entry.transaction_type)');
    expect(helperSource).toContain('error?.code === "23505"');
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
