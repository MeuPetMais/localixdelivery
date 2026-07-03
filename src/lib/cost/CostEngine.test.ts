import { describe, it, expect, vi } from "vitest";
import { CostEngine } from "./CostEngine";
import { MarginEngine } from "./MarginEngine";
import { ProfitabilityEngine } from "./ProfitabilityEngine";
import { WasteCostEngine } from "./WasteCostEngine";
import { PackagingCostEngine } from "./PackagingCostEngine";
import { LaborCostEngine } from "./LaborCostEngine";
import { OverheadEngine } from "./OverheadEngine";
import { SimulationEngine } from "./SimulationEngine";
import { CostAlerts } from "./CostAlerts";
import type { CostRepository, IngredientCostRecord, OrderProfitability, ProductProfitability, RecipeCostSnapshot } from "./types";

function makeRepo(): CostRepository & { orders: Map<string, OrderProfitability> } {
  const orders = new Map<string, OrderProfitability>();
  return {
    orders,
    async getLatestIngredientCost() { return null; },
    async insertIngredientCost(r) {
      return { ...r, id: "ic1", created_at: new Date().toISOString() } as IngredientCostRecord;
    },
    async insertRecipeSnapshot(r) {
      return { ...r, id: "rs1", created_at: new Date().toISOString() } as RecipeCostSnapshot;
    },
    async upsertProductProfitability(r) {
      return { ...r, id: "pp1", last_calculated_at: new Date().toISOString() } as ProductProfitability;
    },
    async insertOrderProfitability(r) {
      const rec = { ...r, id: "op1", created_at: new Date().toISOString() } as OrderProfitability;
      orders.set(r.order_id, rec);
      return rec;
    },
    async getOrderProfitability(id) { return orders.get(id) ?? null; },
  };
}

describe("MarginEngine", () => {
  it("calcula margem, markup, CMV, lucro", () => {
    const m = MarginEngine.calculate({ price: 100, cost: 40 });
    expect(m.grossMargin).toBeCloseTo(60);
    expect(m.markup).toBeCloseTo(150);
    expect(m.cmvPercent).toBeCloseTo(40);
    expect(m.grossProfit).toBeCloseTo(60);
  });
  it("evita divisão por zero", () => {
    const m = MarginEngine.calculate({ price: 0, cost: 0 });
    expect(m.grossMargin).toBe(0);
    expect(m.markup).toBe(0);
  });
});

describe("CostEngine", () => {
  it("registra custo do ingrediente e calcula média ponderada", async () => {
    const engine = new CostEngine(makeRepo());
    const rec = await engine.calculateIngredientCost({
      restaurant_id: "r1", ingredient_id: "i1", unit_cost: 12, previousAverage: 10, previousQty: 5, addedQty: 5,
    });
    expect(rec.unit_cost).toBe(12);
    expect(rec.average_cost).toBeCloseTo(11);
  });

  it("calcula custo da receita com perda", async () => {
    const engine = new CostEngine(makeRepo());
    const { breakdown } = await engine.calculateRecipeCost(
      { id: "rc1", restaurant_id: "r1", yield: 1, labor_cost: 2, overhead_cost: 1, packaging_cost: 0.5, items: [
        { ingredient_id: "i1", quantity: 1, loss_percentage: 10 },
      ] },
      new Map([["i1", 9]]),
    );
    expect(breakdown.ingredient).toBeCloseTo(10, 2);
    expect(breakdown.total).toBeCloseTo(13.5, 2);
  });

  it("calcula lucro do pedido e nunca recalcula (histórico imutável)", async () => {
    const engine = new CostEngine(makeRepo());
    const first = await engine.calculateOrderCost({
      order_id: "o1", restaurant_id: "r1",
      gross_revenue: 100, delivery_cost: 5, gateway_fee: 3, platform_fee: 5,
      recipe_cost: 30, packaging_cost: 2,
    });
    expect(first.net_profit).toBeCloseTo(55);
    expect(first.margin_percentage).toBeCloseTo(55);

    const second = await engine.calculateOrderCost({
      order_id: "o1", restaurant_id: "r1", gross_revenue: 999, recipe_cost: 1,
    });
    expect(second.gross_revenue).toBe(100);
  });

  it("emite evento OrderProfitCalculated", async () => {
    const engine = new CostEngine(makeRepo());
    const { CostEventBus } = await import("./CostEventBus");
    const handler = vi.fn();
    const off = CostEventBus.on(handler);
    await engine.calculateOrderCost({ order_id: "o2", restaurant_id: "r1", gross_revenue: 50, recipe_cost: 20 });
    off();
    expect(handler).toHaveBeenCalled();
  });
});

describe("Extras", () => {
  it("WasteCostEngine soma perdas", () => {
    const r = WasteCostEngine.calculate([{ ingredientId: "i", quantity: 2, unitCost: 3 }]);
    expect(r.totalCost).toBe(6);
  });
  it("PackagingCostEngine soma embalagens", () => {
    expect(PackagingCostEngine.calculate([{ name: "cx", qty: 2, unitCost: 1.5 }])).toBe(3);
  });
  it("LaborCostEngine calcula custo por minuto", () => {
    expect(LaborCostEngine.calculate({ hourlyRate: 60, minutes: 30 })).toBe(30);
  });
  it("OverheadEngine calcula custo por pedido", () => {
    expect(OverheadEngine.perOrder({ energy: 100, water: 50, ordersInPeriod: 10 })).toBe(15);
  });
  it("SimulationEngine compara cenários", () => {
    const s = SimulationEngine.simulate({ currentPrice: 100, currentCost: 40, newCost: 30 });
    expect(s.delta.netProfit).toBeCloseTo(10);
  });
  it("ProfitabilityEngine ranqueia produtos", () => {
    const r = ProfitabilityEngine.topProducts([
      { id: "a", revenue: 100, cost: 50 }, { id: "b", revenue: 200, cost: 80 },
    ]);
    expect(r[0].id).toBe("b");
  });
  it("CostAlerts identifica prejuízo e CMV alto", () => {
    const a = CostAlerts.evaluateProduct({ product_id: "p", net_margin: -5, estimated_profit: -10 });
    expect(a[0].code).toBe("PRODUCT_LOSS");
    const b = CostAlerts.evaluateCMV(50);
    expect(b[0].code).toBe("HIGH_CMV");
  });
});
