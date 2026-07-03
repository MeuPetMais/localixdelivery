import type { Ingredient } from "@/lib/inventory/types";
import type { Recipe, RecipeItem } from "@/lib/recipes/types";
import { effectiveQuantity } from "@/lib/recipes/RecipeYieldEngine";

export interface ValidationIssue { code: string; message: string; }
export interface ValidationResult { valid: boolean; issues: ValidationIssue[]; }

/** Ingredient needs for producing N portions of a recipe (yield-aware, loss-aware). */
export function computeNeeds(recipe: Pick<Recipe, "yield_quantity">, items: RecipeItem[], portions: number) {
  const yieldQ = Number(recipe.yield_quantity || 1);
  const batches = portions / yieldQ;
  return items
    .filter((it) => !it.optional)
    .map((it) => ({ ingredient_id: it.ingredient_id, quantity: effectiveQuantity(it) * batches }));
}

export function validateProduction(
  recipe: Recipe | null,
  items: RecipeItem[],
  ingredients: Ingredient[],
  portions: number,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!recipe) issues.push({ code: "NO_RECIPE", message: "Receita inexistente." });
  else if (recipe.status !== "ACTIVE") issues.push({ code: "RECIPE_INACTIVE", message: `Receita não está ativa (${recipe.status}).` });
  if (portions <= 0) issues.push({ code: "QTY", message: "Quantidade deve ser maior que zero." });

  if (recipe) {
    const map = new Map(ingredients.map((i) => [i.id, i]));
    for (const need of computeNeeds(recipe, items, portions)) {
      const ing = map.get(need.ingredient_id);
      if (!ing) { issues.push({ code: "MISSING_ING", message: `Ingrediente ausente: ${need.ingredient_id}` }); continue; }
      if (!ing.active) issues.push({ code: "ING_INACTIVE", message: `Ingrediente inativo: ${ing.name}` });
      const available = Number(ing.stock ?? 0) - Number(ing.reserved_stock ?? 0);
      if (available < need.quantity) {
        issues.push({ code: "STOCK", message: `Estoque insuficiente de ${ing.name}: ${available} < ${need.quantity.toFixed(3)}` });
      }
    }
  }
  return { valid: issues.length === 0, issues };
}
