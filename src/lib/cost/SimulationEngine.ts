import { MarginEngine } from "./MarginEngine";

export interface SimulationInput {
  currentPrice: number;
  currentCost: number;
  newPrice?: number;
  newCost?: number;
  extraCosts?: number;
}

export const SimulationEngine = {
  simulate(input: SimulationInput) {
    const base = MarginEngine.calculate({
      price: input.currentPrice, cost: input.currentCost, extraCosts: input.extraCosts,
    });
    const scenario = MarginEngine.calculate({
      price: input.newPrice ?? input.currentPrice,
      cost: input.newCost ?? input.currentCost,
      extraCosts: input.extraCosts,
    });
    return {
      base,
      scenario,
      delta: {
        grossMargin: scenario.grossMargin - base.grossMargin,
        netMargin: scenario.netMargin - base.netMargin,
        netProfit: scenario.netProfit - base.netProfit,
      },
    };
  },
};
