import type { Ingredient } from "@/lib/inventory/types";

export interface LossInput { ingredientId: string | null; quantity: number; reason?: string; cost?: number; }
export interface LossComputed { ingredientId: string | null; quantity: number; reason: string | null; cost: number; }

export const ProductionLossEngine = {
  compute(losses: LossInput[], ingredients: Ingredient[]): LossComputed[] {
    const cost = new Map(ingredients.map((i) => [i.id, Number(i.unit_cost ?? 0)]));
    return losses.map((l) => ({
      ingredientId: l.ingredientId,
      quantity: Number(l.quantity),
      reason: l.reason ?? null,
      cost: l.cost != null ? Number(l.cost) : Number(l.quantity) * (cost.get(l.ingredientId ?? "") ?? 0),
    }));
  },
  totalCost(losses: LossComputed[]): number {
    return losses.reduce((s, l) => s + l.cost, 0);
  },
};
