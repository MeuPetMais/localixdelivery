import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const checkoutSource = readFileSync(
  resolve(process.cwd(), "src/routes/$slug.index.tsx"),
  "utf8",
);

describe("checkout transparent card phase 1 guards", () => {
  it("botao final fica bloqueado sem token ou durante tokenizacao", () => {
    expect(checkoutSource).toContain("cardTokenizing");
    expect(checkoutSource).toContain("isTransparentCardPayment && !cardPayment?.token");
  });

  it("erro de tokenizacao impede criacao de pagamento", () => {
    const guardIndex = checkoutSource.indexOf("Valide os dados do cartao antes de finalizar.");
    const paymentIndex = checkoutSource.indexOf("PaymentService.createPayment");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(paymentIndex).toBeGreaterThan(guardIndex);
  });

  it("usa Public Key dedicada e nao expõe segredos Mercado Pago", () => {
    expect(checkoutSource).toContain("PaymentService.getMercadoPagoPublicKey");
    expect(checkoutSource).toContain("publicKey={mercadoPagoPublicKey ?? null}");
    expect(checkoutSource).not.toContain("access_token");
    expect(checkoutSource).not.toContain("client_secret");
  });
});
