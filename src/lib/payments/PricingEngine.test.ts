import { describe, it, expect } from "vitest";
import {
  computePricing,
  DEFAULT_PRICING_SETTINGS,
  PricingError,
} from "./PricingEngine";

const S = DEFAULT_PRICING_SETTINGS;

describe("PricingEngine.computePricing", () => {
  it("recusa pedido abaixo do mínimo (R$19)", () => {
    expect(() => computePricing({ subtotal: 19 }, S)).toThrow(PricingError);
  });

  it("aceita pedido no mínimo exato (R$20) com taxa até 30", () => {
    const r = computePricing({ subtotal: 20 }, S);
    expect(r.platformFee).toBe(0.99);
    expect(r.customerTotal).toBe(20);
  });

  it("pedido R$25 aplica taxa até 30", () => {
    const r = computePricing({ subtotal: 25, deliveryFee: 5 }, S);
    expect(r.platformFee).toBe(0.99);
    expect(r.customerTotal).toBe(30);
    expect(r.restaurantGross).toBe(25);
  });

  it("pedido R$30 fica na faixa até 30 (inclusive)", () => {
    const r = computePricing({ subtotal: 30 }, S);
    expect(r.platformFee).toBe(0.99);
  });

  it("pedido R$31 pula para taxa acima de 30", () => {
    const r = computePricing({ subtotal: 31 }, S);
    expect(r.platformFee).toBe(1.49);
  });

  it("pedido R$50 aplica taxa acima de 30", () => {
    const r = computePricing({ subtotal: 50, deliveryFee: 6 }, S);
    expect(r.platformFee).toBe(1.49);
    expect(r.customerTotal).toBe(56);
  });

  it("pedido com cupom desconta do total do cliente e do líquido do restaurante", () => {
    const r = computePricing(
      { subtotal: 42, deliveryFee: 6, couponDiscount: 2 },
      S,
    );
    expect(r.subtotal).toBe(42);
    expect(r.deliveryFee).toBe(6);
    expect(r.couponDiscount).toBe(2);
    expect(r.platformFee).toBe(1.49);
    expect(r.gatewayFee).toBe(0);
    expect(r.customerTotal).toBe(46); // 42 + 6 - 2
    expect(r.restaurantGross).toBe(42);
    expect(r.restaurantNet).toBe(40);
    expect(r.platformRevenue).toBe(1.49);
    expect(r.gatewayRevenue).toBe(0);
    expect(r.currency).toBe("BRL");
  });
});
