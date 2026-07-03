import type {
  PriceStrategy,
  ProductOption,
  ProductOptionGroup,
  SelectedOption,
} from "./types";

function apply(strategy: PriceStrategy, deltas: number[]): number {
  if (deltas.length === 0) return 0;
  switch (strategy) {
    case "SUM":
      return deltas.reduce((a, b) => a + b, 0);
    case "AVERAGE":
      return deltas.reduce((a, b) => a + b, 0) / deltas.length;
    case "MAX":
      return Math.max(...deltas);
    case "FIXED":
      return 0;
    case "CUSTOM":
      return deltas.reduce((a, b) => a + b, 0);
  }
}

export const PriceCalculationStrategy = {
  calculate(
    basePrice: number,
    groups: ProductOptionGroup[],
    options: ProductOption[],
    selections: SelectedOption[],
    fixedPrice?: number,
  ): number {
    const optionsById = new Map(options.map((o) => [o.id, o]));
    let total = fixedPrice ?? basePrice;
    for (const g of groups) {
      const sel = selections.filter((s) => s.group_id === g.id);
      const deltas: number[] = [];
      for (const s of sel) {
        const opt = optionsById.get(s.option_id);
        if (!opt) continue;
        deltas.push(opt.price_adjustment * s.quantity);
      }
      if (g.price_strategy === "FIXED") continue;
      total += apply(g.price_strategy, deltas);
    }
    return Math.max(0, Math.round(total * 100) / 100);
  },
};
