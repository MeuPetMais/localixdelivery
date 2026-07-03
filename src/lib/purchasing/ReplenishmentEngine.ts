export interface ReplenishmentInput {
  currentStock: number;
  minStock?: number;
  avgDailyConsumption: number;
  leadTimeDays?: number;
  safetyFactor?: number;
  packSize?: number;
}

export interface ReplenishmentResult {
  daysOfStock: number;
  reorderPoint: number;
  safetyStock: number;
  suggestedQuantity: number;
  urgent: boolean;
}

export const ReplenishmentEngine = {
  calculate(i: ReplenishmentInput): ReplenishmentResult {
    const avg = Math.max(0, i.avgDailyConsumption);
    const lead = Math.max(0, i.leadTimeDays ?? 3);
    const safety = Math.max(1, i.safetyFactor ?? 1.5);
    const safetyStock = avg * lead * (safety - 1);
    const reorderPoint = avg * lead + safetyStock;
    const daysOfStock = avg > 0 ? i.currentStock / avg : Infinity;
    const target = avg * lead * safety;
    let suggested = Math.max(0, target - i.currentStock);
    if (i.packSize && i.packSize > 0) {
      suggested = Math.ceil(suggested / i.packSize) * i.packSize;
    }
    const urgent = i.currentStock <= (i.minStock ?? reorderPoint);
    return { daysOfStock, reorderPoint, safetyStock, suggestedQuantity: suggested, urgent };
  },
};
