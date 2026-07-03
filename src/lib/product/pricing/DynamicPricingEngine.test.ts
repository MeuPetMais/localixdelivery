import { describe, it, expect } from "vitest";
import { DynamicPricingService } from "./DynamicPricingService";
import { PromotionRuleEngine } from "./PromotionRuleEngine";
import { DiscountCalculator } from "./DiscountCalculator";
import { DynamicPricingStrategy } from "./DynamicPricingStrategy";
import { PriceSimulation } from "./PriceSimulation";
import type { Promotion, PricingContext } from "./types";

const REST = "rest-1";

function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: over.id ?? "p1",
    restaurant_id: REST,
    name: over.name ?? "Promo",
    status: "ACTIVE",
    priority: 100,
    discount_type: "PERCENTAGE",
    discount_value: 10,
    stackable: false,
    rules: [],
    targets: [],
    ...over,
  } as Promotion;
}

const ctx = (over: Partial<PricingContext> = {}): PricingContext => ({
  restaurant_id: REST,
  lines: [{ product_id: "prod-1", quantity: 2, unit_price: 10 }],
  ...over,
});

describe("DynamicPricingEngine", () => {
  it("PERCENTAGE aplica desconto ao subtotal alvo", () => {
    const r = DynamicPricingService.apply([promo()], ctx());
    expect(r.original_subtotal).toBe(20);
    expect(r.total_discount).toBe(2);
    expect(r.subtotal).toBe(18);
  });

  it("FIXED_AMOUNT respeita subtotal", () => {
    const r = DynamicPricingService.apply(
      [promo({ discount_type: "FIXED_AMOUNT", discount_value: 100 })],
      ctx(),
    );
    expect(r.total_discount).toBe(20);
  });

  it("FIXED_PRICE reduz preço unitário", () => {
    const r = DynamicPricingService.apply(
      [promo({ discount_type: "FIXED_PRICE", discount_value: 7 })],
      ctx(),
    );
    expect(r.total_discount).toBe(6); // (10-7)*2
  });

  it("BUY_X_GET_Y: 2+1 grátis com 3 unidades", () => {
    const r = DynamicPricingService.apply(
      [promo({ discount_type: "BUY_X_GET_Y", discount_value: 0, config: { buy_x: 2, get_y: 1 } })],
      ctx({ lines: [{ product_id: "a", quantity: 3, unit_price: 10 }] }),
    );
    expect(r.total_discount).toBe(10);
  });

  it("FREE_DELIVERY zera taxa de entrega", () => {
    const r = DynamicPricingService.apply(
      [promo({ discount_type: "FREE_DELIVERY", discount_value: 0 })],
      ctx({ delivery_fee: 8 }),
    );
    expect(r.free_delivery).toBe(true);
    expect(r.delivery_fee).toBe(0);
    expect(r.total_discount).toBe(8);
  });

  it("Regra: min_subtotal bloqueia quando abaixo", () => {
    const p = promo({
      rules: [{ id: "r", promotion_id: "p1", rule_type: "min_subtotal", operator: "gte", value: { amount: 50 } }],
    });
    const check = PromotionRuleEngine.isEligible(p, ctx());
    expect(check.eligible).toBe(false);
  });

  it("Regra: weekday limita por dia", () => {
    const now = new Date("2026-07-06T12:00:00Z"); // segunda
    const okMon = PromotionRuleEngine.isEligible(
      promo({ rules: [{ id: "r", promotion_id: "p1", rule_type: "weekday", operator: "in", value: { days: [1] } }] }),
      ctx({ now }),
    );
    expect(okMon.eligible).toBe(true);
  });

  it("Regra: time_window (happy hour) 18-20h", () => {
    const now = new Date();
    now.setHours(19, 0, 0, 0);
    const check = PromotionRuleEngine.isEligible(
      promo({
        rules: [
          { id: "r", promotion_id: "p1", rule_type: "time_window", operator: "between", value: { start: "18:00", end: "20:00" } },
        ],
      }),
      ctx({ now }),
    );
    expect(check.eligible).toBe(true);
  });

  it("Cupom exige coupon_code correto", () => {
    const p = promo({ code: "PROMO10" });
    expect(PromotionRuleEngine.isEligible(p, ctx()).eligible).toBe(false);
    expect(PromotionRuleEngine.isEligible(p, ctx({ coupon_code: "promo10" })).eligible).toBe(true);
  });

  it("Canal: promoção só de delivery não aplica em pickup", () => {
    const p = promo({ channel: "delivery" });
    expect(PromotionRuleEngine.isEligible(p, ctx({ channel: "pickup" })).eligible).toBe(false);
    expect(PromotionRuleEngine.isEligible(p, ctx({ channel: "delivery" })).eligible).toBe(true);
  });

  it("Estratégia BEST_FOR_CUSTOMER escolhe maior desconto", () => {
    const a = { promotion: promo({ id: "a" }), applied: DiscountCalculator.calculate(promo({ id: "a" }), ctx().lines)! };
    const b = {
      promotion: promo({ id: "b", discount_value: 25 }),
      applied: DiscountCalculator.calculate(promo({ id: "b", discount_value: 25 }), ctx().lines)!,
    };
    const picked = DynamicPricingStrategy.select([a, b]);
    expect(picked).toHaveLength(1);
    expect(picked[0].promotion_id).toBe("b");
  });

  it("Estratégia STACKABLE combina cumulativas + melhor não-cumulativa", () => {
    const stack1 = { promotion: promo({ id: "s1", stackable: true }), applied: { promotion_id: "s1", name: "s1", discount_type: "PERCENTAGE" as const, discount_amount: 2 } };
    const stack2 = { promotion: promo({ id: "s2", stackable: true }), applied: { promotion_id: "s2", name: "s2", discount_type: "PERCENTAGE" as const, discount_amount: 3 } };
    const nonStack = { promotion: promo({ id: "n1", stackable: false }), applied: { promotion_id: "n1", name: "n1", discount_type: "PERCENTAGE" as const, discount_amount: 5 } };
    const picked = DynamicPricingStrategy.select([stack1, stack2, nonStack], "STACKABLE");
    expect(picked.map((p) => p.promotion_id).sort()).toEqual(["n1", "s1", "s2"]);
  });

  it("Simulação alerta margem negativa", () => {
    const r = PriceSimulation.run(
      [promo({ discount_value: 90 })],
      ctx(),
      { productCost: () => 9 },
    );
    expect(r.negative_margin).toBe(true);
  });

  it("Promoção não-ativa é ignorada", () => {
    const r = DynamicPricingService.apply([promo({ status: "PAUSED" })], ctx());
    expect(r.applied_promotions).toHaveLength(0);
    expect(r.skipped[0].reason).toBe("status:PAUSED");
  });

  it("Preview retorna original/desconto/final sem persistir", () => {
    const p = DynamicPricingService.preview(promo(), ctx());
    expect(p.eligible).toBe(true);
    expect(p.original_subtotal).toBe(20);
    expect(p.discount).toBe(2);
    expect(p.final_subtotal).toBe(18);
  });
});
