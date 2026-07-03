import { describe, it, expect } from "vitest";
import {
  SalesRankingService, CrossSellService, UpsellService,
  ProductHealthScoreEngine, RecommendationEngine, ProductIntelligenceService,
  ProductPerformanceService,
} from "./index";
import type { OrderLineSample, ProductSalesStat } from "./types";

const REST = "r1";

const stat = (over: Partial<ProductSalesStat> = {}): ProductSalesStat => ({
  product_id: "p", units_sold: 10, revenue: 100, cost: 50, orders: 8, price: 10,
  category_id: "c1", ...over,
});

describe("Product Intelligence Engine", () => {
  const stats: ProductSalesStat[] = [
    stat({ product_id: "a", units_sold: 50, revenue: 500, cost: 200 }),
    stat({ product_id: "b", units_sold: 5, revenue: 50, cost: 45 }),
    stat({ product_id: "c", units_sold: 0, revenue: 0, cost: 0 }),
    stat({ product_id: "d", units_sold: 20, revenue: 200, cost: 20, price: 20 }),
  ];

  it("SalesRankingService: best sellers ordena por unidades", () => {
    expect(SalesRankingService.bestSellers(stats, 2).map((s) => s.product_id)).toEqual(["a", "d"]);
  });

  it("SalesRankingService: top margin ordena por margem", () => {
    expect(SalesRankingService.topMargin(stats, 1)[0].product_id).toBe("d");
  });

  it("Performance calcula profit, margem e ticket médio", () => {
    const p = ProductPerformanceService.compute(stats[0]);
    expect(p.profit).toBe(300);
    expect(p.margin_pct).toBe(60);
    expect(p.avg_ticket).toBe(62.5);
  });

  it("HealthScore combina vendas, margem, disponibilidade, reviews", () => {
    const h = ProductHealthScoreEngine.compute(stats[0], { max_units_in_dataset: 50, is_available: true, in_stock: true, avg_rating: 4.5 });
    expect(h.score).toBeGreaterThan(70);
    const bad = ProductHealthScoreEngine.compute(stats[2], { max_units_in_dataset: 50, is_available: false, in_stock: false });
    expect(bad.score).toBeLessThan(30);
  });

  it("CrossSellService gera pares frequentes", () => {
    const lines: OrderLineSample[] = [
      { order_id: "o1", product_id: "a", quantity: 1 },
      { order_id: "o1", product_id: "b", quantity: 1 },
      { order_id: "o2", product_id: "a", quantity: 1 },
      { order_id: "o2", product_id: "b", quantity: 1 },
      { order_id: "o3", product_id: "a", quantity: 1 },
      { order_id: "o3", product_id: "c", quantity: 1 },
    ];
    const recs = CrossSellService.suggest(REST, lines);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].recommendation_type).toBe("CROSS_SELL");
    expect([recs[0].product_id, recs[0].related_product_id].sort()).toEqual(["a", "b"]);
  });

  it("UpsellService sugere item premium da mesma categoria", () => {
    const recs = UpsellService.suggest(REST, stats);
    expect(recs.every((r) => r.recommendation_type === "UPSELL")).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });

  it("RecommendationEngine: parado gera LOW_SELLER + HIDE", () => {
    const { insights, recommendations } = RecommendationEngine.generate({ restaurant_id: REST, stats });
    expect(insights.some((i) => i.product_id === "c" && i.insight_type === "LOW_SELLER")).toBe(true);
    expect(recommendations.some((r) => r.product_id === "c" && r.recommendation_type === "HIDE")).toBe(true);
  });

  it("RecommendationEngine: margem baixa gera LOW_MARGIN + PRICE_REVIEW", () => {
    const { insights, recommendations } = RecommendationEngine.generate({ restaurant_id: REST, stats });
    expect(insights.some((i) => i.product_id === "b" && i.insight_type === "LOW_MARGIN")).toBe(true);
    expect(recommendations.some((r) => r.product_id === "b" && r.recommendation_type === "PRICE_REVIEW")).toBe(true);
  });

  it("RecommendationEngine: sem estoque gera insight OUT_OF_STOCK crítico", () => {
    const { insights } = RecommendationEngine.generate({
      restaurant_id: REST, stats,
      availability: { a: { is_available: true, in_stock: false } },
    });
    const oos = insights.find((i) => i.product_id === "a" && i.insight_type === "OUT_OF_STOCK");
    expect(oos?.severity).toBe("critical");
  });

  it("RecommendationEngine: best seller gera FEATURED", () => {
    const { recommendations } = RecommendationEngine.generate({ restaurant_id: REST, stats });
    expect(recommendations.some((r) => r.product_id === "a" && r.recommendation_type === "FEATURED")).toBe(true);
  });

  it("ProductIntelligenceService.generate retorna todos os agregados", async () => {
    const r = await ProductIntelligenceService.generate({ restaurant_id: REST, stats });
    expect(r.rankings.best_sellers.length).toBeGreaterThan(0);
    expect(r.performance.length).toBe(stats.length);
    expect(r.health.length).toBe(stats.length);
    expect(r.insights.length).toBeGreaterThan(0);
  });
});
