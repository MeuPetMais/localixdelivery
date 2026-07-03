// DynamicPricingService — orquestra elegibilidade + cálculo + estratégia.
// NUNCA calcula totais finais de pedido — delega ao PricingEngine.
import { PromotionRuleEngine } from "./PromotionRuleEngine";
import { DiscountCalculator } from "./DiscountCalculator";
import { DynamicPricingStrategy, type PricingStrategy } from "./DynamicPricingStrategy";
import type {
  AppliedPromotion,
  DynamicPricingResult,
  PricingContext,
  Promotion,
} from "./types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const DynamicPricingService = {
  /**
   * Aplica todas as promoções ativas elegíveis ao contexto,
   * usando a estratégia informada. Retorna descontos — o total final
   * do pedido continua responsabilidade do PricingEngine.
   */
  apply(
    promotions: Promotion[],
    ctx: PricingContext,
    strategy: PricingStrategy = "BEST_FOR_CUSTOMER",
  ): DynamicPricingResult {
    const originalSubtotal = round2(
      ctx.subtotal ?? ctx.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0),
    );
    const deliveryFee = round2(ctx.delivery_fee ?? 0);

    const skipped: { promotion_id: string; reason: string }[] = [];
    const candidates: { promotion: Promotion; applied: AppliedPromotion }[] = [];

    for (const promo of promotions) {
      const check = PromotionRuleEngine.isEligible(promo, ctx);
      if (!check.eligible) {
        skipped.push({ promotion_id: promo.id, reason: check.reason ?? "ineligible" });
        continue;
      }
      const applied = DiscountCalculator.calculate(promo, ctx.lines, deliveryFee);
      if (!applied) {
        skipped.push({ promotion_id: promo.id, reason: "no_discount" });
        continue;
      }
      candidates.push({ promotion: promo, applied });
    }

    const chosen = DynamicPricingStrategy.select(candidates, strategy);

    const totalDiscount = round2(chosen.reduce((s, a) => s + a.discount_amount, 0));
    const freeDelivery = chosen.some((a) => a.free_delivery);

    return {
      original_subtotal: originalSubtotal,
      subtotal: round2(Math.max(0, originalSubtotal - totalDiscount + (freeDelivery ? 0 : 0))),
      total_discount: totalDiscount,
      delivery_fee: freeDelivery ? 0 : deliveryFee,
      free_delivery: freeDelivery,
      applied_promotions: chosen,
      skipped,
    };
  },

  /**
   * Preview de promoção — retorna preço original, desconto e final por linha,
   * sem tocar em pedidos.
   */
  preview(promotion: Promotion, ctx: PricingContext) {
    const check = PromotionRuleEngine.isEligible(promotion, ctx);
    const applied = check.eligible
      ? DiscountCalculator.calculate(promotion, ctx.lines, ctx.delivery_fee ?? 0)
      : null;
    const originalSubtotal = round2(
      ctx.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0),
    );
    const discount = applied?.discount_amount ?? 0;
    return {
      eligible: check.eligible,
      reason: check.reason,
      original_subtotal: originalSubtotal,
      discount,
      final_subtotal: round2(Math.max(0, originalSubtotal - discount)),
      applied,
    };
  },
};
