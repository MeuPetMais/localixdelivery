import type { ProductSalesStat } from "./types";

export type RankMetric = "units" | "revenue" | "profit" | "margin";

export const SalesRankingService = {
  rank(stats: ProductSalesStat[], metric: RankMetric, limit = 10, direction: "top" | "bottom" = "top") {
    const scored = stats.map((s) => {
      const profit = s.revenue - s.cost;
      const margin = s.revenue > 0 ? (profit / s.revenue) * 100 : 0;
      const value =
        metric === "units" ? s.units_sold :
        metric === "revenue" ? s.revenue :
        metric === "profit" ? profit :
        margin;
      return { ...s, profit, margin_pct: margin, value };
    });
    scored.sort((a, b) => (direction === "top" ? b.value - a.value : a.value - b.value));
    return scored.slice(0, limit);
  },
  bestSellers(stats: ProductSalesStat[], limit = 10) {
    return this.rank(stats, "units", limit, "top");
  },
  lowSellers(stats: ProductSalesStat[], limit = 10) {
    return this.rank(stats, "units", limit, "bottom");
  },
  topRevenue(stats: ProductSalesStat[], limit = 10) {
    return this.rank(stats, "revenue", limit, "top");
  },
  topProfit(stats: ProductSalesStat[], limit = 10) {
    return this.rank(stats, "profit", limit, "top");
  },
  topMargin(stats: ProductSalesStat[], limit = 10) {
    return this.rank(stats, "margin", limit, "top");
  },
};
