export interface WasteItem { ingredientId: string; quantity: number; unitCost: number; reason?: string }
export interface WasteReport { totalQuantity: number; totalCost: number; items: WasteItem[] }

export const WasteCostEngine = {
  calculate(items: WasteItem[]): WasteReport {
    const totalCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
    return { totalCost, totalQuantity, items };
  },
  impactOnMargin(revenue: number, waste: number): number {
    return revenue > 0 ? (waste / revenue) * 100 : 0;
  },
};
