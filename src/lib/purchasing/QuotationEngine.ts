import type { SupplierQuote } from "./types";

export interface QuoteScoreWeights {
  price?: number;
  delivery?: number;
  quality?: number;
}

export interface ScoredQuote extends SupplierQuote {
  score: number;
  supplierRating?: number;
}

export const QuotationEngine = {
  best(quotes: SupplierQuote[]): SupplierQuote | null {
    if (!quotes.length) return null;
    return [...quotes].sort((a, b) => a.price - b.price)[0];
  },

  compare(
    quotes: SupplierQuote[],
    supplierRatings: Map<string, number> = new Map(),
    weights: QuoteScoreWeights = { price: 0.6, delivery: 0.25, quality: 0.15 },
  ): ScoredQuote[] {
    if (!quotes.length) return [];
    const minPrice = Math.min(...quotes.map(q => q.price));
    const minDelivery = Math.min(...quotes.map(q => q.delivery_time ?? 30));
    return quotes
      .map(q => {
        const priceScore = minPrice > 0 ? minPrice / q.price : 1;
        const deliveryScore = minDelivery > 0 ? minDelivery / (q.delivery_time ?? 30) : 1;
        const quality = (supplierRatings.get(q.supplier_id) ?? 3) / 5;
        const score =
          (weights.price ?? 0.6) * priceScore +
          (weights.delivery ?? 0.25) * deliveryScore +
          (weights.quality ?? 0.15) * quality;
        return { ...q, score, supplierRating: supplierRatings.get(q.supplier_id) };
      })
      .sort((a, b) => b.score - a.score);
  },
};
