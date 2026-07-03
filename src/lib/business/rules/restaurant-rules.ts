import type { BusinessRule } from "../types";

export const RULE_RESTAURANT_CAPACITY: BusinessRule = {
  id: "RESTAURANT_CAPACITY",
  name: "Capacidade máxima simultânea",
  description: "Bloqueia novos pedidos quando fila atinge capacidade.",
  priority: 10,
  enabled: true,
  category: "RESTAURANT",
  evaluate(ctx) {
    const max = ctx.restaurant?.max_concurrent_orders;
    const cur = ctx.restaurant?.current_open_orders ?? 0;
    if (max != null && cur >= max) {
      return { allowed: false, rule_code: "RESTAURANT_CAPACITY", severity: "warning", reason: "Restaurante em capacidade máxima." };
    }
    return { allowed: true, rule_code: "RESTAURANT_CAPACITY", severity: "info" };
  },
};
