import type { Ingredient, RecipeLine } from "./types";
import { CostEngine } from "./CostEngine";
import type { InventoryService } from "./InventoryService";

export type { RecipeLine } from "./CostEngine";

export function createProductRecipeService(inventory: InventoryService) {
  return {
    recipeCost(lines: RecipeLine[], ingredients: Ingredient[]) {
      return CostEngine.recipeCost(lines, ingredients);
    },
    async consumeForProduction(
      lines: RecipeLine[],
      opts: { referenceId?: string; performedBy?: string; multiplier?: number } = {},
    ) {
      const mult = opts.multiplier ?? 1;
      for (const l of lines) {
        await inventory.decreaseStock({
          ingredientId: l.ingredient_id,
          quantity: l.quantity * mult,
          referenceType: "recipe",
          referenceId: opts.referenceId,
          performedBy: opts.performedBy,
        }, "PRODUCTION");
      }
    },
  };
}

export type ProductRecipeService = ReturnType<typeof createProductRecipeService>;
