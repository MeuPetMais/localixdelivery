import type { Ingredient } from "./types";

export type AlertLevel = "LOW" | "OUT" | "REORDER" | "EXPIRING";

export interface StockAlert {
  ingredientId: string;
  ingredientName: string;
  level: AlertLevel;
  message: string;
}

export function evaluateAlerts(ingredients: Ingredient[]): StockAlert[] {
  const alerts: StockAlert[] = [];
  for (const i of ingredients) {
    if (!i.active) continue;
    const stock = Number(i.stock ?? 0);
    const min = Number(i.min_stock ?? 0);
    if (stock <= 0) {
      alerts.push({ ingredientId: i.id, ingredientName: i.name, level: "OUT", message: "Sem estoque" });
    } else if (stock <= min * 0.5) {
      alerts.push({ ingredientId: i.id, ingredientName: i.name, level: "LOW", message: "Estoque crítico" });
    } else if (stock <= min) {
      alerts.push({ ingredientId: i.id, ingredientName: i.name, level: "REORDER", message: "Compra recomendada" });
    }
  }
  return alerts;
}
