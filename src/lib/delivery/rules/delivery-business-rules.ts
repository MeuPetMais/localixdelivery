import type { BusinessRule } from "@/lib/business/types";

export const RULE_DELIVERY_MAX_WEIGHT: BusinessRule = {
  id: "DELIVERY_MAX_WEIGHT",
  name: "Peso máximo",
  description: "Peso do pedido não pode ultrapassar o limite do provider.",
  priority: 30,
  enabled: true,
  category: "DELIVERY",
  evaluate(ctx: any) {
    const w = ctx?.delivery?.weight_kg;
    const max = ctx?.delivery?.max_weight_kg;
    if (w != null && max != null && w > max) {
      return { allowed: false, rule_code: "DELIVERY_WEIGHT_EXCEEDED", severity: "error", reason: `Peso ${w}kg > máximo ${max}kg.` };
    }
    return { allowed: true, rule_code: "DELIVERY_MAX_WEIGHT", severity: "info" };
  },
};

export const RULE_DELIVERY_CAPACITY: BusinessRule = {
  id: "DELIVERY_CAPACITY",
  name: "Capacidade de motoristas",
  description: "Precisa haver ao menos um motorista disponível para a estratégia.",
  priority: 40,
  enabled: true,
  category: "DELIVERY",
  evaluate(ctx: any) {
    const strategy = ctx?.delivery?.strategy;
    const available = ctx?.delivery?.available_drivers ?? 1;
    if ((strategy === "LOCALIX" || strategy === "AUTO") && available <= 0) {
      return { allowed: false, rule_code: "DELIVERY_NO_DRIVERS", severity: "error", reason: "Nenhum motorista disponível." };
    }
    return { allowed: true, rule_code: "DELIVERY_CAPACITY", severity: "info" };
  },
};

export const DELIVERY_BUSINESS_RULES = [RULE_DELIVERY_MAX_WEIGHT, RULE_DELIVERY_CAPACITY];
