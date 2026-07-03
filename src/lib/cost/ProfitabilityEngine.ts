export interface RankableItem { id: string; label?: string; revenue: number; cost: number }
export interface RankedItem extends RankableItem { profit: number; margin: number }

function rank(items: RankableItem[]): RankedItem[] {
  return items
    .map(i => {
      const profit = i.revenue - i.cost;
      const margin = i.revenue > 0 ? (profit / i.revenue) * 100 : 0;
      return { ...i, profit, margin };
    })
    .sort((a, b) => b.profit - a.profit);
}

export const ProfitabilityEngine = {
  topProducts: rank,
  topCategories: rank,
  topOrders: rank,
  topCustomers: rank,
  topHours: rank,
  restaurantSummary(items: RankableItem[]) {
    const revenue = items.reduce((s, i) => s + i.revenue, 0);
    const cost = items.reduce((s, i) => s + i.cost, 0);
    const profit = revenue - cost;
    return {
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
  },
};
