import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const providerSource = readFileSync(
  resolve(process.cwd(), "src/lib/payments/providers/MercadoPagoProvider.ts"),
  "utf8",
);

const cardBranch = providerSource.slice(
  providerSource.indexOf('if (input.method === "card")'),
  providerSource.indexOf('const { data, error } = await supabase.functions.invoke("mp-payment-intent"'),
);

describe("MercadoPagoProvider transparent card feature flag", () => {
  it("esta habilitada para chamar o backend transparente", () => {
    expect(providerSource).toContain("export const MP_TRANSPARENT_CARD_BACKEND_ENABLED = true");
  });

  it("quando desabilitada nao faz fallback silencioso para Checkout Pro", () => {
    expect(cardBranch).toContain("if (!MP_TRANSPARENT_CARD_BACKEND_ENABLED)");
    expect(cardBranch).toContain("redirectUrl: null");
    expect(cardBranch).toContain("externalId: null");
    expect(cardBranch).not.toContain("createCardPreference");
    expect(cardBranch).not.toContain("checkout/preferences");
    expect(cardBranch).not.toContain("init_point");
  });

  it("cartao habilitado delega para mp-payment-intent com contrato transparente", () => {
    expect(providerSource).toContain('supabase.functions.invoke("mp-payment-intent"');
    expect(providerSource).toContain("body: buildMercadoPagoPaymentIntentBody(input)");
    expect(providerSource).toContain('payment_method: input.method === "card" ? "credit_card" : "pix"');
    expect(providerSource).toContain('transparent_card_phase: "backend_payment_enabled"');
  });
});
