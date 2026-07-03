import type { BusinessRule } from "../types";

export const RULE_DELIVERY_AVAILABLE: BusinessRule = {
  id: "DELIVERY_AVAILABLE",
  name: "Delivery disponível",
  description: "Restaurante precisa oferecer entrega ativa.",
  priority: 5,
  enabled: true,
  category: "DELIVERY",
  evaluate(ctx) {
    if (ctx.delivery?.available === false) {
      return { allowed: false, rule_code: "DELIVERY_UNAVAILABLE", severity: "error", reason: "Entrega indisponível no momento." };
    }
    return { allowed: true, rule_code: "DELIVERY_AVAILABLE", severity: "info" };
  },
};

export const RULE_DELIVERY_AREA: BusinessRule = {
  id: "DELIVERY_AREA",
  name: "Área atendida",
  description: "Endereço precisa estar dentro da área de atendimento.",
  priority: 10,
  enabled: true,
  category: "DELIVERY",
  evaluate(ctx) {
    if (ctx.delivery?.inside_service_area === false) {
      return { allowed: false, rule_code: "DELIVERY_OUT_OF_AREA", severity: "error", reason: "Endereço fora da área de atendimento." };
    }
    return { allowed: true, rule_code: "DELIVERY_AREA", severity: "info" };
  },
};

export const RULE_DELIVERY_DISTANCE: BusinessRule = {
  id: "DELIVERY_DISTANCE",
  name: "Distância máxima",
  description: "Distância não pode exceder o raio máximo do restaurante.",
  priority: 20,
  enabled: true,
  category: "DELIVERY",
  evaluate(ctx) {
    const max = ctx.restaurant?.delivery_radius_km;
    const dist = ctx.delivery?.distance_km;
    if (max != null && dist != null && dist > max) {
      return { allowed: false, rule_code: "DELIVERY_TOO_FAR", severity: "error", reason: `Distância ${dist.toFixed(1)} km acima do limite ${max} km.` };
    }
    return { allowed: true, rule_code: "DELIVERY_DISTANCE", severity: "info" };
  },
};
