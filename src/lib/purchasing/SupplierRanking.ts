export interface SupplierScoreInput {
  supplier_id: string;
  name?: string;
  avgPrice?: number;
  onTimeDeliveryRate?: number; // 0-1
  qualityRating?: number; // 0-5
  totalOrders?: number;
}

export interface RankedSupplier extends SupplierScoreInput {
  score: number;
}

export const SupplierRanking = {
  rank(items: SupplierScoreInput[]): RankedSupplier[] {
    if (!items.length) return [];
    const prices = items.map(i => i.avgPrice ?? 0).filter(p => p > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    return items
      .map(i => {
        const priceScore = i.avgPrice && i.avgPrice > 0 ? minPrice / i.avgPrice : 0.5;
        const delivery = i.onTimeDeliveryRate ?? 0.8;
        const quality = (i.qualityRating ?? 3) / 5;
        const volume = Math.min(1, (i.totalOrders ?? 0) / 50);
        const score = priceScore * 0.4 + delivery * 0.3 + quality * 0.2 + volume * 0.1;
        return { ...i, score };
      })
      .sort((a, b) => b.score - a.score);
  },
};
