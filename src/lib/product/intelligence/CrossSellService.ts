import type { OrderLineSample, ProductRecommendation } from "./types";

// Cross-sell = pares frequentemente comprados juntos.
export const CrossSellService = {
  suggest(restaurant_id: string, lines: OrderLineSample[], limit = 20): ProductRecommendation[] {
    const perOrder = new Map<string, Set<string>>();
    for (const l of lines) {
      if (!perOrder.has(l.order_id)) perOrder.set(l.order_id, new Set());
      perOrder.get(l.order_id)!.add(l.product_id);
    }
    const pairs = new Map<string, { a: string; b: string; count: number }>();
    for (const set of perOrder.values()) {
      const ids = Array.from(set).sort();
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const key = `${ids[i]}|${ids[j]}`;
          const cur = pairs.get(key) ?? { a: ids[i], b: ids[j], count: 0 };
          cur.count += 1;
          pairs.set(key, cur);
        }
    }
    const totalOrders = perOrder.size || 1;
    const recs: ProductRecommendation[] = Array.from(pairs.values())
      .filter((p) => p.count > 1)
      .map((p) => ({
        restaurant_id,
        recommendation_type: "CROSS_SELL",
        product_id: p.a,
        related_product_id: p.b,
        score: Math.round((p.count / totalOrders) * 10000) / 100,
        metadata: { count: p.count, total_orders: totalOrders },
      }));
    recs.sort((a, b) => b.score - a.score);
    return recs.slice(0, limit);
  },
};
