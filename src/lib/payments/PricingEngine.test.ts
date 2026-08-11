import { describe, it, expect } from "vitest";
import {
  computePricing,
  DEFAULT_PRICING_SETTINGS,
  PricingError,
  type PricingSettings,
} from "./PricingEngine";

const tieredSettings: PricingSettings = DEFAULT_PRICING_SETTINGS;
const flat099Settings: PricingSettings = {
  ...DEFAULT_PRICING_SETTINGS,
  minimum_order: 0,
  platform_fee_until_30: 0.99,
  platform_fee_above_30: 0.99,
  service_fee_payer: "customer",
};

describe("PricingEngine.computePricing", () => {
  it("recusa pedido abaixo do minimo configurado", () => {
    expect(() => computePricing({ subtotal: 19 }, tieredSettings)).toThrow(PricingError);
  });

  it("cliente paga taxa: subtotal 50, taxa 0.99, total 50.99 sem entrega", () => {
    const r = computePricing({ subtotal: 50, serviceFeePayer: "customer" }, flat099Settings);
    expect(r.serviceFeePayer).toBe("customer");
    expect(r.platformFee).toBe(0.99);
    expect(r.expectedPlatformFee).toBe(0.99);
    expect(r.expectedPlatformRevenue).toBe(0.99);
    expect(r.realizedPlatformRevenue).toBe(0);
    expect(r.customerTotal).toBe(50.99);
    expect(r.restaurantNet).toBe(50);
  });

  it("restaurante paga taxa: subtotal 50, taxa 0.99, total cliente 50.00", () => {
    const r = computePricing({ subtotal: 50, serviceFeePayer: "restaurant" }, flat099Settings);
    expect(r.serviceFeePayer).toBe("restaurant");
    expect(r.platformFee).toBe(0.99);
    expect(r.customerTotal).toBe(50);
    expect(r.restaurantNet).toBe(49.01);
  });

  it("cliente paga taxa + entrega: subtotal 50, entrega 5, taxa 0.99, total 55.99", () => {
    const r = computePricing(
      { subtotal: 50, deliveryFee: 5, serviceFeePayer: "customer" },
      flat099Settings,
    );
    expect(r.customerTotal).toBe(55.99);
    expect(r.deliveryFee).toBe(5);
    expect(r.restaurantNet).toBe(50);
  });

  it("restaurante paga taxa + entrega: subtotal 50, entrega 5, taxa 0.99, total 55.00", () => {
    const r = computePricing(
      { subtotal: 50, deliveryFee: 5, serviceFeePayer: "restaurant" },
      flat099Settings,
    );
    expect(r.customerTotal).toBe(55);
    expect(r.deliveryFee).toBe(5);
    expect(r.restaurantNet).toBe(49.01);
  });

  it("aplica cupom e desconto no total do cliente e no liquido do restaurante", () => {
    const r = computePricing(
      { subtotal: 50, deliveryFee: 5, couponDiscount: 4, loyaltyDiscount: 1, serviceFeePayer: "customer" },
      flat099Settings,
    );
    expect(r.customerTotal).toBe(50.99);
    expect(r.restaurantNet).toBe(45);
    expect(r.platformFee).toBe(0.99);
  });

  it("frete gratis equivale a entrega zero sem misturar com taxa Localix", () => {
    const r = computePricing({ subtotal: 50, deliveryFee: 0, serviceFeePayer: "customer" }, flat099Settings);
    expect(r.deliveryFee).toBe(0);
    expect(r.platformFee).toBe(0.99);
    expect(r.customerTotal).toBe(50.99);
  });

  it("pedido de valor baixo usa centavos corretamente quando minimo permite", () => {
    const r = computePricing({ subtotal: 10.01, serviceFeePayer: "customer" }, flat099Settings);
    expect(r.customerTotal).toBe(11);
  });

  it("arredonda em centavos: 29.99 + 0.99 = 30.98", () => {
    const r = computePricing({ subtotal: 29.99, serviceFeePayer: "customer" }, flat099Settings);
    expect(r.customerTotal).toBe(30.98);
  });

  it("mantem fronteiras de regra atual 0.99/1.49 quando configurada em faixas", () => {
    const settings = { ...tieredSettings, minimum_order: 0 };
    expect(computePricing({ subtotal: 29.99 }, settings).platformFee).toBe(0.99);
    expect(computePricing({ subtotal: 30 }, settings).platformFee).toBe(0.99);
    expect(computePricing({ subtotal: 30.01 }, settings).platformFee).toBe(1.49);
  });

  it("suporta taxa zero se configurada", () => {
    const settings: PricingSettings = {
      ...flat099Settings,
      platform_fee_until_30: 0,
      platform_fee_above_30: 0,
    };
    const r = computePricing({ subtotal: 50, serviceFeePayer: "customer" }, settings);
    expect(r.platformFee).toBe(0);
    expect(r.customerTotal).toBe(50);
  });

  it("configuracao ausente de pagador usa customer", () => {
    const settings: PricingSettings = {
      ...flat099Settings,
      service_fee_payer: undefined,
    };
    const r = computePricing({ subtotal: 50 }, settings);
    expect(r.serviceFeePayer).toBe("customer");
    expect(r.customerTotal).toBe(50.99);
  });

  it("configuracao invalida de pagador usa customer", () => {
    const settings = {
      ...flat099Settings,
      service_fee_payer: "invalid",
    } as unknown as PricingSettings;
    const r = computePricing({ subtotal: 50 }, settings);
    expect(r.serviceFeePayer).toBe("customer");
    expect(r.customerTotal).toBe(50.99);
  });

  it("produz snapshot financeiro completo com campos explicitos", () => {
    const r = computePricing({ subtotal: 50, deliveryFee: 6 }, flat099Settings);
    for (const k of [
      "subtotal",
      "deliveryFee",
      "platformFee",
      "gatewayFee",
      "couponDiscount",
      "cashback",
      "restaurantGross",
      "restaurantNet",
      "serviceFeePayer",
      "expectedPlatformFee",
      "expectedPlatformRevenue",
      "realizedPlatformRevenue",
      "platformRevenue",
      "gatewayRevenue",
      "customerTotal",
      "currency",
    ] as const) {
      expect(r[k]).not.toBeUndefined();
    }
  });
});
