import type {
  CustomerAnalytics,
  CustomerRecommendation,
  CustomerScore,
  CustomerSegment,
} from "./types";

/**
 * Pure rule-based recommendations. Not AI. Prepares hooks for future AI Engine.
 */
export const CustomerRecommendationService = {
  recommend(
    a: CustomerAnalytics,
    score: CustomerScore,
    segment: CustomerSegment,
  ): CustomerRecommendation[] {
    const recs: CustomerRecommendation[] = [];
    const cid = a.customer_id;

    if (segment === "INACTIVE" || segment === "AT_RISK") {
      recs.push({
        customer_id: cid,
        action: "REACTIVATE",
        reason: `Cliente sem comprar há ${a.days_since_last_order} dias`,
        priority: segment === "INACTIVE" ? 10 : 8,
      });
      recs.push({
        customer_id: cid,
        action: "SEND_COUPON",
        reason: "Cupom de reativação",
        priority: 7,
        metadata: { discount_hint: segment === "INACTIVE" ? 20 : 10 },
      });
    }

    if (segment === "VIP") {
      recs.push({
        customer_id: cid,
        action: "OFFER_CASHBACK",
        reason: "Manter fidelidade do VIP",
        priority: 9,
        metadata: { cashback_percent: 10 },
      });
    }

    if (a.avg_ticket < 40 && a.total_orders >= 2) {
      recs.push({
        customer_id: cid,
        action: "OFFER_COMBO",
        reason: "Aumentar ticket médio",
        priority: 5,
      });
    }

    if (a.favorite_categories[0]) {
      recs.push({
        customer_id: cid,
        action: "HIGHLIGHT_PRODUCT",
        reason: `Categoria favorita: ${a.favorite_categories[0].name ?? a.favorite_categories[0].category_id}`,
        priority: 4,
        metadata: { category_id: a.favorite_categories[0].category_id },
      });
    }

    if (score.breakdown.engagement >= 60 && segment !== "INACTIVE") {
      recs.push({
        customer_id: cid,
        action: "SEND_CAMPAIGN",
        reason: "Alta engajamento — bom alvo para campanhas",
        priority: 3,
      });
    }

    return recs.sort((x, y) => y.priority - x.priority);
  },
} as const;
