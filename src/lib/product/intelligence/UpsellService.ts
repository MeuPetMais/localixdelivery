import type { ProductRecommendation, ProductSalesStat } from "./types";

// Upsell = sugerir item premium da mesma categoria com maior ticket/margem.
export const UpsellService = {
  suggest(restaurant_id: string, stats: ProductSalesStat[], limit = 20): ProductRecommendation[] {
    const byCat = new Map<string, ProductSalesStat[]>();
    for (const s of stats) {
      const key = s.category_id ?? "_none";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(s);
    }
    const recs: ProductRecommendation[] = [];
    for (const items of byCat.values()) {
      if (items.length < 2) continue;
      const sorted = [...items].sort((a, b) => a.price - b.price);
      const base = sorted[0];
      for (const premium of sorted.slice(1)) {
        recs.push({
          restaurant_id,
          recommendation_type: "UPSELL",
          product_id: base.product_id,
          related_product_id: premium.product_id,
          score: Math.round((premium.price - base.price) * 100) / 100,
          metadata: { base_price: base.price, premium_price: premium.price },
        });
      }
    }
    recs.sort((a, b) => b.score - a.score);
    return recs.slice(0, limit);
  },
};
