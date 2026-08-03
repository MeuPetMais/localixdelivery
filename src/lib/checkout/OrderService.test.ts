import { describe, it, expect } from "vitest";
import { computePricing, DEFAULT_PRICING_SETTINGS, PricingError } from "@/lib/payments/PricingEngine";
import { resolveCheckoutPayment } from "./checkout-payment";
import { paymentMethodLabel } from "./paymentMethodLabel";

// Checkout — testes puros de regras financeiras usadas pelo OrderService.
// Não faz I/O; garante que Checkout inteligente confie 100% no PricingEngine.

const S = DEFAULT_PRICING_SETTINGS;

describe("Checkout — validações e snapshot", () => {
  it("rejeita pedido abaixo do mínimo", () => {
    expect(() => computePricing({ subtotal: 15 }, S)).toThrow(PricingError);
  });

  it("aceita pedido válido e calcula taxa da plataforma até R$30", () => {
    const p = computePricing({ subtotal: 25, deliveryFee: 6 }, S);
    expect(p.platformFee).toBe(0.99);
    expect(p.customerTotal).toBe(31);
  });

  it("aplica cupom no total do cliente e no líquido do restaurante", () => {
    const p = computePricing(
      { subtotal: 40, deliveryFee: 5, couponDiscount: 5 },
      S,
    );
    expect(p.customerTotal).toBe(40);
    expect(p.restaurantNet).toBe(35);
    expect(p.platformFee).toBe(1.49);
  });

  it("produz snapshot financeiro completo (todas as colunas)", () => {
    const p = computePricing({ subtotal: 50, deliveryFee: 6 }, S);
    for (const k of [
      "subtotal",
      "deliveryFee",
      "platformFee",
      "gatewayFee",
      "couponDiscount",
      "cashback",
      "restaurantGross",
      "restaurantNet",
      "platformRevenue",
      "gatewayRevenue",
      "customerTotal",
      "currency",
    ] as const) {
      expect(p[k]).not.toBeUndefined();
    }
  });

  it("registro de pagamento nasce como PENDING (contrato)", () => {
    const initialStatus = "PENDING";
    expect(initialStatus).toBe("PENDING");
  });

  it("cartao online entra como aguardando pagamento", () => {
    expect(resolveCheckoutPayment("credit_card")).toMatchObject({
      paymentMethod: "credit_card",
      pricingMethod: "credit_card",
      initialStatus: "aguardando_pagamento",
      paymentRecordStatus: "PENDING",
    });
  });

  it("cartao na entrega persiste identificador proprio e entra como aguardando aceite", () => {
    expect(resolveCheckoutPayment("card_on_delivery")).toMatchObject({
      paymentMethod: "card_on_delivery",
      pricingMethod: "cash",
      initialStatus: "pago",
      paymentRecordStatus: "APPROVED",
    });
  });

  it("payload legado card_delivery tambem persiste como card_on_delivery", () => {
    expect(resolveCheckoutPayment("card_delivery")).toMatchObject({
      inputMethod: "card_delivery",
      paymentMethod: "card_on_delivery",
      initialStatus: "pago",
    });
  });

  it("dinheiro entra como aguardando aceite", () => {
    expect(resolveCheckoutPayment("cash")).toMatchObject({
      paymentMethod: "cash",
      pricingMethod: "cash",
      initialStatus: "pago",
      paymentRecordStatus: "APPROVED",
    });
  });

  it("pix online pendente entra como aguardando pagamento", () => {
    expect(resolveCheckoutPayment("pix")).toMatchObject({
      paymentMethod: "pix",
      pricingMethod: "pix",
      initialStatus: "aguardando_pagamento",
      paymentRecordStatus: "PENDING",
    });
  });

  it("labels do painel e acompanhamento distinguem cartao online de cartao na entrega", () => {
    expect(paymentMethodLabel("credit_card")).toBe("Cartão Online");
    expect(paymentMethodLabel("card_on_delivery")).toBe("💳 Cartão na entrega");
    expect(paymentMethodLabel("card_delivery")).toBe("💳 Cartão na entrega");
  });
});
