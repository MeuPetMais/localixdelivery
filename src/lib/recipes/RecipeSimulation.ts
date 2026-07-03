import type { RecipeService } from "./RecipeService";
import type { RecipeItem, Recipe } from "./types";
import type { Ingredient } from "@/lib/inventory/types";
import { RecipeCostEngine } from "./RecipeCostEngine";
import { effectiveQuantity } from "./RecipeYieldEngine";

export interface SimulationResult {
  possiblePortions: number;
  bottleneck: string | null;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  stockImpact: { ingredient_id: string; needed: number; available: number; shortfall: number }[];
}

export function simulateProduction(
  recipe: Recipe,
  items: RecipeItem[],
  ingredients: Ingredient[],
  portions: number,
  price = 0,
): SimulationResult {
  const map = new Map(ingredients.map((i) => [i.id, i]));
  const yieldQ = Number(recipe.yield_quantity || 1);
  const batches = portions / yieldQ;
  const stockImpact = items
    .filter((i) => !i.optional)
    .map((it) => {
      const needed = effectiveQuantity(it) * batches;
      const available = Number(map.get(it.ingredient_id)?.stock ?? 0);
      return { ingredient_id: it.ingredient_id, needed, available, shortfall: Math.max(0, needed - available) };
    });
  let possiblePortions = portions;
  let bottleneck: string | null = null;
  for (const it of items) {
    if (it.optional) continue;
    const per = effectiveQuantity(it) / yieldQ;
    if (per <= 0) continue;
    const avail = Number(map.get(it.ingredient_id)?.stock ?? 0);
    const capacity = avail / per;
    if (capacity < possiblePortions) { possiblePortions = capacity; bottleneck = it.ingredient_id; }
  }
  const totalCost = RecipeCostEngine.totalCost(items, ingredients) * batches;
  const totalRevenue = price * portions;
  return {
    possiblePortions: Math.max(0, Math.floor(possiblePortions)),
    bottleneck,
    totalCost,
    totalRevenue,
    profit: totalRevenue - totalCost,
    stockImpact,
  };
}

export async function buildRecipePreview(svc: RecipeService, recipeId: string, price = 0) {
  const c = await svc.get(recipeId);
  if (!c) return null;
  const cost = await svc.cost(recipeId, price);
  return { recipe: c.recipe, items: c.items, cost };
}
