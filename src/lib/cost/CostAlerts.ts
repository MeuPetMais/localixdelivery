export interface CostAlert {
  code: "LOW_MARGIN" | "PRODUCT_LOSS" | "EXPENSIVE_INGREDIENT" | "HIGH_CMV";
  severity: "info" | "warn" | "critical";
  message: string;
  meta?: Record<string, unknown>;
}

export const CostAlerts = {
  evaluateProduct(p: { product_id: string; net_margin: number; estimated_profit: number }): CostAlert[] {
    const alerts: CostAlert[] = [];
    if (p.estimated_profit < 0) {
      alerts.push({
        code: "PRODUCT_LOSS",
        severity: "critical",
        message: `Produto ${p.product_id} operando com prejuízo`,
        meta: p,
      });
    } else if (p.net_margin < 10) {
      alerts.push({
        code: "LOW_MARGIN",
        severity: "warn",
        message: `Margem líquida abaixo de 10% (${p.net_margin.toFixed(1)}%)`,
        meta: p,
      });
    }
    return alerts;
  },
  evaluateIngredient(prevCost: number, newCost: number, threshold = 0.2): CostAlert[] {
    if (prevCost <= 0) return [];
    const delta = (newCost - prevCost) / prevCost;
    if (delta >= threshold) {
      return [{
        code: "EXPENSIVE_INGREDIENT",
        severity: "warn",
        message: `Ingrediente subiu ${(delta * 100).toFixed(1)}%`,
      }];
    }
    return [];
  },
  evaluateCMV(cmvPercent: number, target = 35): CostAlert[] {
    if (cmvPercent > target) {
      return [{
        code: "HIGH_CMV",
        severity: cmvPercent > target + 10 ? "critical" : "warn",
        message: `CMV em ${cmvPercent.toFixed(1)}% (meta ${target}%)`,
      }];
    }
    return [];
  },
};
