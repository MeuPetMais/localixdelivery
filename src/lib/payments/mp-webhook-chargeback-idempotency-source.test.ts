import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webhookSource = readFileSync(
  new URL("../../../supabase/functions/mp-webhook/index.ts", import.meta.url),
  "utf8",
);
const chargebackSource = readFileSync(
  new URL("../../../supabase/functions/mp-webhook/chargeback-ledger.ts", import.meta.url),
  "utf8",
);

describe("mp-webhook chargeback case identity", () => {
  it("routes topic_chargebacks_wh through the chargeback API and stable case id", () => {
    expect(webhookSource).toContain('eventType === "topic_chargebacks_wh"');
    expect(webhookSource).toContain("/v1/chargebacks/");
    expect(webhookSource).toContain('"X-Caller-Id": sellerId');
    expect(webhookSource).toContain("recordChargebackLedger(sb");
    expect(webhookSource).toContain("chargebackId: resourceId");
    expect(webhookSource).toContain('reference_type: "mp_chargeback"');
    expect(webhookSource).toContain('mpStatus !== "charged_back" || mpStatusDetail !== "settled"');
    expect(webhookSource).toContain("chargeback_reimbursed_to_seller");
    expect(webhookSource).toContain("chargeback_not_settled");
  });

  it("does not write generic payment charged_back directly to financial_ledger", () => {
    expect(webhookSource).toContain("chargeback ledger deferred to chargeback case notification");
    expect(webhookSource).not.toContain(
      'reference_type: "mp_payment",\n        reference_id: String(mp.id),\n        description: "Chargeback"',
    );
  });

  it("ledger helper deduplicates by provider chargeback case and handles races", () => {
    expect(chargebackSource).toContain('const referenceType = "mp_chargeback"');
    expect(chargebackSource).toContain("const referenceId = input.chargebackId");
    expect(chargebackSource).toContain('const transactionType = "CHARGEBACK"');
    expect(chargebackSource).toContain('.eq("provider", "mercado_pago")');
    expect(chargebackSource).toContain('error?.code === "23505"');
    expect(chargebackSource).toContain("chargeback_id: input.chargebackId");
    expect(chargebackSource).toContain("payment_id: input.paymentId");
  });
});
