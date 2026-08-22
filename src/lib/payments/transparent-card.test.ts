import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeMercadoPagoCardFormData } from "./transparent-card";

describe("Mercado Pago transparent card tokenization", () => {
  it("retorna apenas objeto sanitizado necessario ao backend", () => {
    const card = sanitizeMercadoPagoCardFormData({
      token: "card-token",
      paymentMethodId: "visa",
      issuerId: "25",
      installments: "2",
      cardholderEmail: "cliente@exemplo.com",
      identificationType: "CPF",
      identificationNumber: "123.456.789-09",
    });

    expect(card).toEqual({
      token: "card-token",
      paymentMethodId: "visa",
      issuerId: "25",
      installments: 2,
      payer: {
        identificationType: "CPF",
        identificationNumber: "12345678909",
      },
    });
    expect(JSON.stringify(card)).not.toMatch(/card_number|security_code|cvv|1234 5678/i);
  });

  it("exige token, metodo de pagamento e parcelas", () => {
    expect(() => sanitizeMercadoPagoCardFormData({ paymentMethodId: "visa", installments: 1 }))
      .toThrow(/card_token_required/);
    expect(() => sanitizeMercadoPagoCardFormData({ token: "tok", installments: 1 }))
      .toThrow(/payment_method_required/);
    expect(() => sanitizeMercadoPagoCardFormData({ token: "tok", paymentMethodId: "visa" }))
      .toThrow(/installments_required/);
  });

  it("componente exige Public Key e bloqueia dupla tokenizacao", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/checkout/MercadoPagoCardPayment.tsx"),
      "utf8",
    );
    expect(source).toContain("if (!publicKey)");
    expect(source).toContain("if (tokenizing || disabled) return");
    expect(source).toContain("loadMercadoPago");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
  });
});
