import type { ProductHealthScore, ProductSalesStat } from "./types";

export interface HealthInputExtras {
  is_available?: boolean;
  in_stock?: boolean;
  avg_rating?: number | null;
  reviews_count?: number;
  max_units_in_dataset?: number;
}

export const ProductHealthScoreEngine = {
  compute(stat: ProductSalesStat, extras: HealthInputExtras = {}): ProductHealthScore {
    const maxUnits = Math.max(1, extras.max_units_in_dataset ?? stat.units_sold);
    const salesScore = Math.min(100, (stat.units_sold / maxUnits) * 100);
    const profit = stat.revenue - stat.cost;
    const marginPct = stat.revenue > 0 ? (profit / stat.revenue) * 100 : 0;
    const marginScore = Math.max(0, Math.min(100, marginPct * 2)); // 50% margin -> 100
    const availabilityScore = extras.is_available !== false && extras.in_stock !== false ? 100 : 0;
    const reviewsScore = extras.avg_rating != null ? Math.max(0, Math.min(100, (extras.avg_rating / 5) * 100)) : 60;

    const score = Math.round(
      salesScore * 0.4 + marginScore * 0.3 + availabilityScore * 0.2 + reviewsScore * 0.1,
    );
    return {
      product_id: stat.product_id,
      score,
      breakdown: {
        sales: Math.round(salesScore),
        margin: Math.round(marginScore),
        availability: availabilityScore,
        reviews: Math.round(reviewsScore),
      },
    };
  },
};
