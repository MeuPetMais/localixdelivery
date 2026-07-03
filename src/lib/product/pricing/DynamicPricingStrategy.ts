// Aplica a estratégia de escolha entre promoções elegíveis.
// Estratégias: BEST_FOR_CUSTOMER (default), PRIORITY, STACKABLE.
import type { AppliedPromotion, Promotion } from "./types";

export type PricingStrategy = "BEST_FOR_CUSTOMER" | "PRIORITY" | "STACKABLE";

export const DynamicPricingStrategy = {
  select(
    promotions: { promotion: Promotion; applied: AppliedPromotion }[],
    strategy: PricingStrategy = "BEST_FOR_CUSTOMER",
  ): AppliedPromotion[] {
    if (promotions.length === 0) return [];
    if (strategy === "STACKABLE") {
      // Aceita todas marcadas como stackable + a melhor não-stackable
      const stack = promotions.filter((p) => p.promotion.stackable).map((p) => p.applied);
      const nonStack = promotions.filter((p) => !p.promotion.stackable);
      if (nonStack.length > 0) {
        nonStack.sort((a, b) => b.applied.discount_amount - a.applied.discount_amount);
        stack.push(nonStack[0].applied);
      }
      return stack;
    }
    if (strategy === "PRIORITY") {
      const sorted = [...promotions].sort((a, b) => a.promotion.priority - b.promotion.priority);
      return [sorted[0].applied];
    }
    // BEST_FOR_CUSTOMER
    const sorted = [...promotions].sort((a, b) => b.applied.discount_amount - a.applied.discount_amount);
    return [sorted[0].applied];
  },
};
