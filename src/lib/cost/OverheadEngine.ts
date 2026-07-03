export interface OverheadInput {
  energy?: number;
  water?: number;
  gas?: number;
  rent?: number;
  ordersInPeriod?: number;
}

export const OverheadEngine = {
  monthlyTotal(i: OverheadInput): number {
    return (i.energy ?? 0) + (i.water ?? 0) + (i.gas ?? 0) + (i.rent ?? 0);
  },
  perOrder(i: OverheadInput): number {
    const total = this.monthlyTotal(i);
    const n = Math.max(1, i.ordersInPeriod ?? 1);
    return total / n;
  },
};
