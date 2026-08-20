import { describe, it, expect } from "vitest";
import { CustomerAnalyticsService } from "./CustomerAnalyticsService";
import { CustomerScoreService } from "./CustomerScoreService";
import { CustomerSegmentationService } from "./CustomerSegmentationService";
import { CustomerRecommendationService } from "./CustomerRecommendationService";
import { CustomerIntelligenceService } from "./CustomerIntelligenceService";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const ordersActive = [
  { id: "1", total: 60, created_at: daysAgo(2), items: [{ id: "p1", name: "Pizza", qty: 1, category_id: "c1" }], payment_method: "pix", status: "entregue" },
  { id: "2", total: 80, created_at: daysAgo(10), items: [{ id: "p1", name: "Pizza", qty: 2, category_id: "c1" }], payment_method: "pix", status: "entregue" },
  { id: "3", total: 45, created_at: daysAgo(20), items: [{ id: "p2", name: "Burger", qty: 1, category_id: "c2" }], payment_method: "credit", status: "concluido" },
];

describe("CustomerAnalyticsService", () => {
  it("computes totals, ticket, favorites", () => {
    const a = CustomerAnalyticsService.compute("cust", "rest", ordersActive);
    expect(a.total_orders).toBe(3);
    expect(a.total_spent).toBe(185);
    expect(a.avg_ticket).toBeCloseTo(61.67, 1);
    expect(a.favorite_products[0].product_id).toBe("p1");
    expect(a.favorite_channel).toBe("pix");
    expect(a.days_since_last_order).toBeLessThanOrEqual(3);
  });

  it("handles empty orders", () => {
    const a = CustomerAnalyticsService.compute("c", "r", []);
    expect(a.total_orders).toBe(0);
    expect(a.avg_ticket).toBe(0);
    expect(a.favorite_channel).toBeNull();
  });

  it("usa somente vendas realizadas para compras, gasto, datas, frequencia e recorrencia", () => {
    const a = CustomerAnalyticsService.compute("c", "r", [
      { id: "1", total: 10, created_at: daysAgo(30), items: [{ id: "pending", name: "Pending", qty: 1 }], payment_method: "pix", status: "aguardando_pagamento" },
      { id: "2", total: 20, created_at: daysAgo(25), items: [{ id: "failed", name: "Failed", qty: 1 }], payment_method: "pix", status: "falha_pagamento" },
      { id: "3", total: 30, created_at: daysAgo(20), items: [{ id: "canceled", name: "Canceled", qty: 1 }], payment_method: "cash", status: "cancelado" },
      { id: "4", total: 40, created_at: daysAgo(12), items: [{ id: "valid-first", name: "Pizza", qty: 1 }], payment_method: "pix", status: "entregue" },
      { id: "5", total: 50, created_at: daysAgo(3), items: [{ id: "valid-last", name: "Burger", qty: 2 }], payment_method: "card", status: "concluido" },
      { id: "6", total: 60, created_at: daysAgo(1), items: [{ id: "refunded", name: "Refunded", qty: 1 }], payment_method: "pix", status: "reembolsado" },
    ]);

    expect(a.total_orders).toBe(2);
    expect(a.total_spent).toBe(90);
    expect(a.avg_ticket).toBe(45);
    expect(a.tenure_days).toBeGreaterThanOrEqual(12);
    expect(a.days_since_last_order).toBeLessThanOrEqual(4);
    expect(a.days_since_last_order).toBeGreaterThanOrEqual(2);
    expect(a.frequency_per_month).toBe(2);
    expect(a.favorite_products.map((product) => product.product_id)).toEqual(["valid-last", "valid-first"]);
  });

  it("nao atribui compra realizada a cliente com pedidos sem vendas realizadas", () => {
    const a = CustomerAnalyticsService.compute("c", "r", [
      { id: "1", total: 10, created_at: daysAgo(30), items: [{ id: "pending", name: "Pending", qty: 1 }], payment_method: "pix", status: "aguardando_pagamento" },
      { id: "2", total: 20, created_at: daysAgo(25), items: [{ id: "failed", name: "Failed", qty: 1 }], payment_method: "pix", status: "falha_pagamento" },
      { id: "3", total: 30, created_at: daysAgo(20), items: [{ id: "canceled", name: "Canceled", qty: 1 }], payment_method: "cash", status: "cancelado" },
    ]);

    expect(a.total_orders).toBe(0);
    expect(a.total_spent).toBe(0);
    expect(a.avg_ticket).toBe(0);
    expect(a.frequency_per_month).toBe(0);
    expect(a.tenure_days).toBe(0);
    expect(a.days_since_last_order).toBe(9999);
    expect(a.favorite_products).toEqual([]);
    expect(a.favorite_channel).toBeNull();
  });
});

describe("CustomerScoreService", () => {
  it("scores active customer high on recency", () => {
    const a = CustomerAnalyticsService.compute("c", "r", ordersActive);
    const s = CustomerScoreService.compute(a);
    expect(s.breakdown.recency).toBeGreaterThan(70);
    expect(s.health_score).toBeGreaterThan(0);
    expect(s.health_score).toBeLessThanOrEqual(100);
  });

  it("scores inactive low", () => {
    const a = CustomerAnalyticsService.compute("c", "r", [
      { id: "1", total: 30, created_at: daysAgo(120), items: [], payment_method: "pix", status: "entregue" },
    ]);
    const s = CustomerScoreService.compute(a);
    expect(s.breakdown.recency).toBe(0);
  });
});

describe("CustomerSegmentationService", () => {
  it("classifies NEW when single order", () => {
    const a = CustomerAnalyticsService.compute("c", "r", [ordersActive[0]]);
    const s = CustomerScoreService.compute(a);
    const seg = CustomerSegmentationService.resolve(a, s);
    expect(seg.tags).toContain("NEW");
  });

  it("classifies INACTIVE when >90d", () => {
    const a = CustomerAnalyticsService.compute("c", "r", [
      { id: "1", total: 30, created_at: daysAgo(120), items: [], payment_method: "pix", status: "entregue" },
      { id: "2", total: 30, created_at: daysAgo(200), items: [], payment_method: "pix", status: "concluido" },
    ]);
    const s = CustomerScoreService.compute(a);
    const seg = CustomerSegmentationService.resolve(a, s);
    expect(seg.primary).toBe("INACTIVE");
  });

  it("classifies VIP by spend", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `o${i}`, total: 120, created_at: daysAgo(i * 3), items: [], payment_method: "pix", status: "entregue",
    }));
    const a = CustomerAnalyticsService.compute("c", "r", many);
    const s = CustomerScoreService.compute(a);
    const seg = CustomerSegmentationService.resolve(a, s);
    expect(seg.tags).toContain("VIP");
  });
});

describe("CustomerRecommendationService", () => {
  it("recommends REACTIVATE for inactive", () => {
    const a = CustomerAnalyticsService.compute("c", "r", [
      { id: "1", total: 30, created_at: daysAgo(120), items: [], payment_method: "pix", status: "entregue" },
    ]);
    const s = CustomerScoreService.compute(a);
    const recs = CustomerRecommendationService.recommend(a, s, "INACTIVE");
    expect(recs[0].action).toBe("REACTIVATE");
  });

  it("recommends cashback for VIP", () => {
    const a = CustomerAnalyticsService.compute("c", "r", ordersActive);
    const s = CustomerScoreService.compute(a);
    const recs = CustomerRecommendationService.recommend(a, s, "VIP");
    expect(recs.find((r) => r.action === "OFFER_CASHBACK")).toBeDefined();
  });
});

describe("CustomerIntelligenceService.buildInsights", () => {
  it("flags VIP_INACTIVE", () => {
    const a = CustomerAnalyticsService.compute("c", "r", [
      { id: "1", total: 800, created_at: daysAgo(45), items: [], payment_method: "pix", status: "entregue" },
    ]);
    const s = CustomerScoreService.compute(a);
    const ins = CustomerIntelligenceService.buildInsights("r", "c", a, s, "VIP");
    expect(ins.find((i) => i.insight_type === "VIP_INACTIVE")).toBeDefined();
  });

  it("flags NO_PURCHASE", () => {
    const a = CustomerAnalyticsService.compute("c", "r", []);
    const s = CustomerScoreService.compute(a);
    const ins = CustomerIntelligenceService.buildInsights("r", "c", a, s, "NEW");
    expect(ins[0].insight_type).toBe("NO_PURCHASE");
  });
});
