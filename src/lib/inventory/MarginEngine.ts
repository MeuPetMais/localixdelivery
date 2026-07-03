export interface MarginResult {
  cost: number;
  price: number;
  profit: number;
  marginPct: number;
  markupPct: number;
}

export const MarginEngine = {
  compute(cost: number, price: number): MarginResult {
    const profit = price - cost;
    const marginPct = price > 0 ? (profit / price) * 100 : 0;
    const markupPct = cost > 0 ? (profit / cost) * 100 : 0;
    return { cost, price, profit, marginPct, markupPct };
  },
  suggestPrice(cost: number, targetMarginPct: number): number {
    if (targetMarginPct >= 100) return cost;
    return cost / (1 - targetMarginPct / 100);
  },
};
