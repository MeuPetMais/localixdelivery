// Simulação de impacto de promoções na margem.
// Integra com CostEngine/MarginEngine sem duplicar lógica.
import { MarginEngine } from "@/lib/inventory/MarginEngine";
import { DynamicPricingService } from "./DynamicPricingService";
import type { PricingContext, Promotion } from "./types";

export interface CostLookup {
  productCost(productId: string): number;
}

export interface SimulationResult {
  original_subtotal: number;
  final_subtotal: number;
  total_discount: number;
  total_cost: number;
  gross_profit: number;
  margin_pct: number;
  negative_margin: boolean;
}

export const PriceSimulation = {
  run(promotions: Promotion[], ctx: PricingContext, costs: CostLookup): SimulationResult {
    const pricing = DynamicPricingService.apply(promotions, ctx);
    const totalCost = ctx.lines.reduce((s, l) => s + costs.productCost(l.product_id) * l.quantity, 0);
    const m = MarginEngine.compute(totalCost, pricing.subtotal);
    return {
      original_subtotal: pricing.original_subtotal,
      final_subtotal: pricing.subtotal,
      total_discount: pricing.total_discount,
      total_cost: Math.round(totalCost * 100) / 100,
      gross_profit: m.profit,
      margin_pct: m.marginPct,
      negative_margin: m.profit < 0,
    };
  },
};
