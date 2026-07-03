export interface IngredientCostRecord {
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  supplier_id?: string | null;
  purchase_order_id?: string | null;
  unit_cost: number;
  average_cost?: number | null;
  currency: string;
  effective_from: string;
  effective_until?: string | null;
  created_at: string;
}

export interface RecipeCostSnapshot {
  id: string;
  restaurant_id: string;
  recipe_id: string;
  recipe_version: number;
  ingredient_cost: number;
  labor_cost: number;
  overhead_cost: number;
  packaging_cost: number;
  total_cost: number;
  created_at: string;
}

export interface ProductProfitability {
  id: string;
  restaurant_id: string;
  product_id: string;
  sale_price: number;
  recipe_cost: number;
  gross_margin: number;
  net_margin: number;
  estimated_profit: number;
  last_calculated_at: string;
}

export interface OrderProfitability {
  id: string;
  order_id: string;
  restaurant_id: string;
  gross_revenue: number;
  delivery_cost: number;
  gateway_fee: number;
  platform_fee: number;
  recipe_cost: number;
  packaging_cost: number;
  estimated_profit: number;
  net_profit: number;
  margin_percentage: number;
  created_at: string;
}

export interface CostBreakdown {
  ingredient: number;
  labor: number;
  overhead: number;
  packaging: number;
  total: number;
}

export interface OrderCostInput {
  order_id: string;
  restaurant_id: string;
  gross_revenue: number;
  delivery_cost?: number;
  gateway_fee?: number;
  platform_fee?: number;
  recipe_cost?: number;
  packaging_cost?: number;
}

export interface CostRepository {
  getLatestIngredientCost(ingredientId: string): Promise<IngredientCostRecord | null>;
  insertIngredientCost(rec: Omit<IngredientCostRecord, "id" | "created_at">): Promise<IngredientCostRecord>;
  insertRecipeSnapshot(rec: Omit<RecipeCostSnapshot, "id" | "created_at">): Promise<RecipeCostSnapshot>;
  upsertProductProfitability(rec: Omit<ProductProfitability, "id" | "last_calculated_at">): Promise<ProductProfitability>;
  insertOrderProfitability(rec: Omit<OrderProfitability, "id" | "created_at">): Promise<OrderProfitability>;
  getOrderProfitability(orderId: string): Promise<OrderProfitability | null>;
}
