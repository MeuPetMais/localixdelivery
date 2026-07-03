export type CostEvent =
  | { name: "IngredientCostUpdated"; ingredientId: string; unitCost: number; averageCost: number }
  | { name: "RecipeCostUpdated"; recipeId: string; totalCost: number; version: number }
  | { name: "ProductProfitUpdated"; productId: string; margin: number; profit: number }
  | { name: "OrderProfitCalculated"; orderId: string; netProfit: number; margin: number }
  | { name: "MarginChanged"; entity: "product" | "order" | "recipe"; id: string; margin: number };

type Handler = (e: CostEvent) => void;

class Bus {
  private handlers = new Set<Handler>();
  on(h: Handler) { this.handlers.add(h); return () => this.handlers.delete(h); }
  emit(e: CostEvent) { this.handlers.forEach(h => { try { h(e); } catch { /* ignore */ } }); }
}

export const CostEventBus = new Bus();
