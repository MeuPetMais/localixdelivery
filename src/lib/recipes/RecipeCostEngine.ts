import type { Ingredient } from "@/lib/inventory/types";
import type { Recipe, RecipeItem, RecipeItemInput } from "./types";
import { effectiveQuantity } from "./RecipeYieldEngine";

export interface RecipeCostBreakdown {
  totalCost: number;
  costPerPortion: number;
  costPerUnit: number;
  marginPct: number;
  grossProfit: number;
  price: number;
}

export const RecipeCostEngine = {
  totalCost(items: (RecipeItem | RecipeItemInput)[], ingredients: Ingredient[]): number {
    const map = new Map(ingredients.map((i) => [i.id, Number(i.unit_cost ?? 0)]));
    return items.reduce((sum, it) => sum + effectiveQuantity(it) * (map.get(it.ingredient_id) ?? 0), 0);
  },
  compute(
    recipe: Pick<Recipe, "yield_quantity">,
    items: (RecipeItem | RecipeItemInput)[],
    ingredients: Ingredient[],
    price = 0,
  ): RecipeCostBreakdown {
    const totalCost = this.totalCost(items, ingredients);
    const y = Number(recipe.yield_quantity || 1);
    const costPerPortion = totalCost / y;
    const grossProfit = price - costPerPortion;
    const marginPct = price > 0 ? (grossProfit / price) * 100 : 0;
    return {
      totalCost,
      costPerPortion,
      costPerUnit: costPerPortion,
      marginPct,
      grossProfit,
      price,
    };
  },
};
