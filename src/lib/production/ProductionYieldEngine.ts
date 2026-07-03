export interface YieldResult {
  planned: number;
  actual: number;
  diff: number;
  efficiencyPct: number;
}

export const ProductionYieldEngine = {
  compute(planned: number, actual: number): YieldResult {
    const efficiencyPct = planned > 0 ? (actual / planned) * 100 : 0;
    return { planned, actual, diff: actual - planned, efficiencyPct };
  },
};
