// ProductIntelligenceService — orquestra rankings + insights + recomendações.
// Consome dados agregados fornecidos pelo caller (nunca replica queries de outros domínios).
import { RecommendationEngine, type RecommendationInput } from "./RecommendationEngine";
import { SalesRankingService } from "./SalesRankingService";
import { ProductPerformanceService } from "./ProductPerformanceService";
import { ProductHealthScoreEngine } from "./ProductHealthScoreEngine";
import { IntelligenceEventBus } from "./IntelligenceEventBus";

export const ProductIntelligenceService = {
  async generate(input: RecommendationInput) {
    const { insights, recommendations } = RecommendationEngine.generate(input);

    const rankings = {
      best_sellers: SalesRankingService.bestSellers(input.stats),
      low_sellers: SalesRankingService.lowSellers(input.stats),
      top_revenue: SalesRankingService.topRevenue(input.stats),
      top_profit: SalesRankingService.topProfit(input.stats),
      top_margin: SalesRankingService.topMargin(input.stats),
    };

    const performance = ProductPerformanceService.computeMany(input.stats);

    const maxUnits = Math.max(1, ...input.stats.map((s) => s.units_sold));
    const health = input.stats.map((s) =>
      ProductHealthScoreEngine.compute(s, {
        is_available: input.availability?.[s.product_id]?.is_available,
        in_stock: input.availability?.[s.product_id]?.in_stock,
        max_units_in_dataset: maxUnits,
      }),
    );

    await IntelligenceEventBus.publish({
      name: "InsightGenerated",
      restaurant_id: input.restaurant_id,
      at: new Date().toISOString(),
      payload: { insights_count: insights.length, recommendations_count: recommendations.length },
    });

    return { insights, recommendations, rankings, performance, health };
  },
};
