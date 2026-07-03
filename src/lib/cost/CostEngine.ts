import type {
  CostBreakdown, CostRepository, IngredientCostRecord, OrderCostInput,
  OrderProfitability, ProductProfitability, RecipeCostSnapshot,
} from "./types";
import { MarginEngine } from "./MarginEngine";
import { CostEventBus } from "./CostEventBus";

export interface RecipeItemForCost {
  ingredient_id: string;
  quantity: number;
  loss_percentage?: number;
}

export interface RecipeForCost {
  id: string;
  restaurant_id: string;
  version?: number;
  yield?: number;
  labor_cost?: number;
  overhead_cost?: number;
  packaging_cost?: number;
  items: RecipeItemForCost[];
}

export class CostEngine {
  constructor(private repo: CostRepository) {}

  /** Registra novo custo unitário para o ingrediente (histórico imutável). */
  async calculateIngredientCost(input: {
    restaurant_id: string;
    ingredient_id: string;
    unit_cost: number;
    supplier_id?: string | null;
    purchase_order_id?: string | null;
    previousAverage?: number | null;
    previousQty?: number;
    addedQty?: number;
    currency?: string;
    effective_from?: string;
  }): Promise<IngredientCostRecord> {
    const avg = this.calculateAverageCost({
      previousAverage: input.previousAverage ?? null,
      previousQty: input.previousQty ?? 0,
      newUnitCost: input.unit_cost,
      addedQty: input.addedQty ?? 0,
    });
    const rec = await this.repo.insertIngredientCost({
      restaurant_id: input.restaurant_id,
      ingredient_id: input.ingredient_id,
      supplier_id: input.supplier_id ?? null,
      purchase_order_id: input.purchase_order_id ?? null,
      unit_cost: input.unit_cost,
      average_cost: avg,
      currency: input.currency ?? "BRL",
      effective_from: input.effective_from ?? new Date().toISOString(),
      effective_until: null,
    });
    CostEventBus.emit({
      name: "IngredientCostUpdated",
      ingredientId: input.ingredient_id,
      unitCost: input.unit_cost,
      averageCost: avg,
    });
    return rec;
  }

  /** Cálculo de custo médio ponderado (moving average). */
  calculateAverageCost(input: {
    previousAverage: number | null;
    previousQty: number;
    newUnitCost: number;
    addedQty: number;
  }): number {
    const prevAvg = input.previousAverage ?? 0;
    const prevQty = Math.max(0, input.previousQty);
    const addQty = Math.max(0, input.addedQty);
    const total = prevQty + addQty;
    if (total <= 0) return input.newUnitCost;
    return (prevAvg * prevQty + input.newUnitCost * addQty) / total;
  }

  /** Calcula custo total de uma receita e cria snapshot imutável. */
  async calculateRecipeCost(
    recipe: RecipeForCost,
    ingredientCosts: Map<string, number>,
  ): Promise<{ breakdown: CostBreakdown; snapshot: RecipeCostSnapshot }> {
    let ingredientCost = 0;
    for (const item of recipe.items) {
      const unit = ingredientCosts.get(item.ingredient_id) ?? 0;
      const loss = Math.min(0.99, Math.max(0, (item.loss_percentage ?? 0) / 100));
      const effectiveQty = item.quantity / (1 - loss);
      ingredientCost += unit * effectiveQty;
    }
    const yieldQty = Math.max(1, recipe.yield ?? 1);
    const perPortion = {
      ingredient: ingredientCost / yieldQty,
      labor: (recipe.labor_cost ?? 0) / yieldQty,
      overhead: (recipe.overhead_cost ?? 0) / yieldQty,
      packaging: (recipe.packaging_cost ?? 0) / yieldQty,
    };
    const total = perPortion.ingredient + perPortion.labor + perPortion.overhead + perPortion.packaging;
    const breakdown: CostBreakdown = { ...perPortion, total };

    const snapshot = await this.repo.insertRecipeSnapshot({
      restaurant_id: recipe.restaurant_id,
      recipe_id: recipe.id,
      recipe_version: recipe.version ?? 1,
      ingredient_cost: perPortion.ingredient,
      labor_cost: perPortion.labor,
      overhead_cost: perPortion.overhead,
      packaging_cost: perPortion.packaging,
      total_cost: total,
    });
    CostEventBus.emit({
      name: "RecipeCostUpdated",
      recipeId: recipe.id,
      totalCost: total,
      version: recipe.version ?? 1,
    });
    return { breakdown, snapshot };
  }

  /** Custo unitário de um produto vinculado a uma receita. */
  async calculateProductCost(input: {
    restaurant_id: string;
    product_id: string;
    sale_price: number;
    recipe_cost: number;
    extraCosts?: number;
  }): Promise<ProductProfitability> {
    const m = MarginEngine.calculate({
      price: input.sale_price,
      cost: input.recipe_cost,
      extraCosts: input.extraCosts,
    });
    const rec = await this.repo.upsertProductProfitability({
      restaurant_id: input.restaurant_id,
      product_id: input.product_id,
      sale_price: input.sale_price,
      recipe_cost: input.recipe_cost,
      gross_margin: m.grossMargin,
      net_margin: m.netMargin,
      estimated_profit: m.netProfit,
    });
    CostEventBus.emit({
      name: "ProductProfitUpdated",
      productId: input.product_id,
      margin: m.netMargin,
      profit: m.netProfit,
    });
    return rec;
  }

  /**
   * Calcula o lucro do pedido e grava snapshot imutável.
   * Nunca recalcula pedido já persistido.
   */
  async calculateOrderCost(input: OrderCostInput): Promise<OrderProfitability> {
    const existing = await this.repo.getOrderProfitability(input.order_id);
    if (existing) return existing;

    const gross = Number(input.gross_revenue) || 0;
    const delivery = Number(input.delivery_cost) || 0;
    const gateway = Number(input.gateway_fee) || 0;
    const platform = Number(input.platform_fee) || 0;
    const recipe = Number(input.recipe_cost) || 0;
    const packaging = Number(input.packaging_cost) || 0;

    const totalCost = recipe + packaging + delivery + gateway + platform;
    const netProfit = gross - totalCost;
    const estimatedProfit = gross - recipe - packaging;
    const margin = gross > 0 ? (netProfit / gross) * 100 : 0;

    const rec = await this.repo.insertOrderProfitability({
      order_id: input.order_id,
      restaurant_id: input.restaurant_id,
      gross_revenue: gross,
      delivery_cost: delivery,
      gateway_fee: gateway,
      platform_fee: platform,
      recipe_cost: recipe,
      packaging_cost: packaging,
      estimated_profit: estimatedProfit,
      net_profit: netProfit,
      margin_percentage: margin,
    });
    CostEventBus.emit({
      name: "OrderProfitCalculated",
      orderId: input.order_id,
      netProfit,
      margin,
    });
    return rec;
  }
}
