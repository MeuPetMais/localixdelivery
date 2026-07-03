import type { Ingredient } from "./types";

export interface RecipeLine { ingredient_id: string; quantity: number; }

export const CostEngine = {
  ingredientCost(ing: Ingredient, quantity: number): number {
    return Number(ing.unit_cost ?? 0) * quantity;
  },
  recipeCost(recipe: RecipeLine[], ingredients: Ingredient[]): number {
    const map = new Map(ingredients.map((i) => [i.id, i] as const));
    return recipe.reduce((sum, l) => {
      const ing = map.get(l.ingredient_id);
      return ing ? sum + this.ingredientCost(ing, l.quantity) : sum;
    }, 0);
  },
  stockValue(ingredients: Ingredient[]): number {
    return ingredients.reduce((s, i) => s + Number(i.stock ?? 0) * Number(i.unit_cost ?? 0), 0);
  },
};
