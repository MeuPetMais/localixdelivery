export interface PackagingItem { name: string; qty: number; unitCost: number }

export const PackagingCostEngine = {
  calculate(items: PackagingItem[]): number {
    return items.reduce((s, i) => s + i.qty * i.unitCost, 0);
  },
  breakdown(items: PackagingItem[]) {
    return items.map(i => ({ name: i.name, cost: i.qty * i.unitCost }));
  },
};
