export interface MarginInput {
  price: number;
  cost: number;
  extraCosts?: number;
}
export interface MarginResult {
  grossMargin: number;
  netMargin: number;
  markup: number;
  cmvPercent: number;
  profitPercent: number;
  grossProfit: number;
  netProfit: number;
}

export const MarginEngine = {
  calculate({ price, cost, extraCosts = 0 }: MarginInput): MarginResult {
    const p = Math.max(0, Number(price) || 0);
    const c = Math.max(0, Number(cost) || 0);
    const e = Math.max(0, Number(extraCosts) || 0);
    const grossProfit = p - c;
    const netProfit = p - c - e;
    const grossMargin = p > 0 ? (grossProfit / p) * 100 : 0;
    const netMargin = p > 0 ? (netProfit / p) * 100 : 0;
    const markup = c > 0 ? ((p - c) / c) * 100 : 0;
    const cmvPercent = p > 0 ? (c / p) * 100 : 0;
    const profitPercent = p > 0 ? (netProfit / p) * 100 : 0;
    return { grossMargin, netMargin, markup, cmvPercent, profitPercent, grossProfit, netProfit };
  },
};
