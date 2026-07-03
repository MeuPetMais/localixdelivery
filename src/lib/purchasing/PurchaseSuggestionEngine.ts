import { ReplenishmentEngine, type ReplenishmentInput } from "./ReplenishmentEngine";

export interface SuggestionInput extends ReplenishmentInput {
  ingredient_id: string;
  name?: string;
  preferredSupplierId?: string;
  unitCost?: number;
}

export interface PurchaseSuggestion {
  ingredient_id: string;
  name?: string;
  quantity: number;
  estimatedCost: number;
  urgent: boolean;
  daysOfStock: number;
  preferredSupplierId?: string;
}

export const PurchaseSuggestionEngine = {
  suggest(items: SuggestionInput[]): PurchaseSuggestion[] {
    return items
      .map(it => {
        const r = ReplenishmentEngine.calculate(it);
        return {
          ingredient_id: it.ingredient_id,
          name: it.name,
          quantity: r.suggestedQuantity,
          estimatedCost: r.suggestedQuantity * (it.unitCost ?? 0),
          urgent: r.urgent,
          daysOfStock: r.daysOfStock,
          preferredSupplierId: it.preferredSupplierId,
        };
      })
      .filter(s => s.quantity > 0)
      .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.daysOfStock - b.daysOfStock);
  },
};
