import type {
  ProductInsight, ProductRecommendation, ProductSalesStat, OrderLineSample,
} from "./types";
import { SalesRankingService } from "./SalesRankingService";
import { CrossSellService } from "./CrossSellService";
import { UpsellService } from "./UpsellService";
import { ProductHealthScoreEngine } from "./ProductHealthScoreEngine";

export interface RecommendationInput {
  restaurant_id: string;
  stats: ProductSalesStat[];
  lines?: OrderLineSample[];
  availability?: Record<string, { is_available: boolean; in_stock: boolean }>;
  lowMarginThresholdPct?: number; // default 15
  highMarginThresholdPct?: number; // default 60
  staleUnitsThreshold?: number; // default 0
}

export const RecommendationEngine = {
  generate(input: RecommendationInput): {
    insights: ProductInsight[];
    recommendations: ProductRecommendation[];
  } {
    const { restaurant_id, stats } = input;
    const lowMargin = input.lowMarginThresholdPct ?? 15;
    const highMargin = input.highMarginThresholdPct ?? 60;
    const stale = input.staleUnitsThreshold ?? 0;

    const insights: ProductInsight[] = [];
    const recs: ProductRecommendation[] = [];

    const maxUnits = Math.max(1, ...stats.map((s) => s.units_sold));

    for (const s of stats) {
      const profit = s.revenue - s.cost;
      const margin = s.revenue > 0 ? (profit / s.revenue) * 100 : 0;
      const av = input.availability?.[s.product_id];
      const health = ProductHealthScoreEngine.compute(s, {
        is_available: av?.is_available,
        in_stock: av?.in_stock,
        max_units_in_dataset: maxUnits,
      });

      if (s.units_sold <= stale) {
        insights.push({
          restaurant_id, product_id: s.product_id, insight_type: "LOW_SELLER",
          severity: "warning", title: "Produto parado",
          description: `Sem vendas no período (${s.name ?? s.product_id}).`,
          metadata: { units: s.units_sold, health: health.score },
        });
        recs.push({ restaurant_id, recommendation_type: "HIDE", product_id: s.product_id, score: 100 - health.score });
      } else if (s.units_sold >= maxUnits * 0.7) {
        insights.push({
          restaurant_id, product_id: s.product_id, insight_type: "BEST_SELLER",
          severity: "info", title: "Muito vendido",
          description: `Top vendas do período (${s.units_sold} un).`,
          metadata: { units: s.units_sold, health: health.score },
        });
        recs.push({ restaurant_id, recommendation_type: "FEATURED", product_id: s.product_id, score: health.score });
      }

      if (s.revenue > 0 && margin < lowMargin) {
        insights.push({
          restaurant_id, product_id: s.product_id, insight_type: "LOW_MARGIN",
          severity: margin < 0 ? "critical" : "warning",
          title: margin < 0 ? "Produto em prejuízo" : "Margem baixa",
          description: `Margem ${margin.toFixed(1)}% — revisar preço ou receita.`,
          metadata: { margin_pct: margin, profit, cost: s.cost },
        });
        recs.push({ restaurant_id, recommendation_type: "PRICE_REVIEW", product_id: s.product_id, score: Math.round(100 - margin) });
        recs.push({ restaurant_id, recommendation_type: "RECIPE_REVIEW", product_id: s.product_id, score: Math.round(100 - margin) });
      } else if (margin >= highMargin) {
        insights.push({
          restaurant_id, product_id: s.product_id, insight_type: "HIGH_MARGIN",
          severity: "info", title: "Alta margem",
          description: `Margem ${margin.toFixed(1)}% — bom candidato a destaque.`,
          metadata: { margin_pct: margin },
        });
      }

      if (av && av.in_stock === false) {
        insights.push({
          restaurant_id, product_id: s.product_id, insight_type: "OUT_OF_STOCK",
          severity: "critical", title: "Sem estoque",
          description: "Produto sem estoque disponível.",
          metadata: {},
        });
      }
    }

    if (input.lines?.length) {
      recs.push(...CrossSellService.suggest(restaurant_id, input.lines));
    }
    recs.push(...UpsellService.suggest(restaurant_id, stats));

    return { insights, recommendations: recs };
  },
};
