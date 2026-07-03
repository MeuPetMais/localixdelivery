import type { ProductSalesStat, ProductPerformance } from "./types";
import { MarginEngine } from "@/lib/inventory/MarginEngine";

export const ProductPerformanceService = {
  compute(stat: ProductSalesStat): ProductPerformance {
    const m = MarginEngine.compute(stat.cost, stat.revenue);
    return {
      product_id: stat.product_id,
      revenue: Math.round(stat.revenue * 100) / 100,
      cost: Math.round(stat.cost * 100) / 100,
      profit: m.profit,
      margin_pct: m.marginPct,
      orders: stat.orders,
      units: stat.units_sold,
      avg_ticket: stat.orders > 0 ? Math.round((stat.revenue / stat.orders) * 100) / 100 : 0,
    };
  },
  computeMany(stats: ProductSalesStat[]) {
    return stats.map((s) => this.compute(s));
  },
};
