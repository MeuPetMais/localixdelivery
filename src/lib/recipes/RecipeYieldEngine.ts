import type { RecipeItem, RecipeItemInput } from "./types";

/** Effective quantity accounting for loss: q / (1 - loss%) */
export function effectiveQuantity(item: Pick<RecipeItem | RecipeItemInput, "quantity" | "loss_percentage" | "optional"> & { optional?: boolean }): number {
  if (item.optional) return 0;
  const loss = Number(item.loss_percentage ?? 0) / 100;
  const q = Number(item.quantity);
  return loss > 0 && loss < 1 ? q / (1 - loss) : q;
}

export const RecipeYieldEngine = {
  effectiveQuantity,
  totalLoss(items: RecipeItem[] | RecipeItemInput[]): number {
    return items.reduce((sum, it) => sum + (effectiveQuantity(it) - Number(it.quantity)), 0);
  },
  utilizationPct(items: RecipeItem[] | RecipeItemInput[]): number {
    const raw = items.reduce((s, i) => s + Number(i.quantity), 0);
    const eff = items.reduce((s, i) => s + effectiveQuantity(i), 0);
    return eff > 0 ? (raw / eff) * 100 : 100;
  },
  perPortion(totalQuantity: number, yieldQuantity: number): number {
    return yieldQuantity > 0 ? totalQuantity / yieldQuantity : totalQuantity;
  },
};
