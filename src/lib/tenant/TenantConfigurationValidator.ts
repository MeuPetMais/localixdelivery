import type { ConfigGroup, GroupPayload } from "./types";

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const HHMM = /^\d{2}:\d{2}$/;
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ALLOWED_GATEWAYS = new Set(["mercado_pago", "stripe", "manual"]);

export function validateGroup<G extends ConfigGroup>(group: G, value: GroupPayload<G>): ValidationResult {
  const issues: ValidationIssue[] = [];
  const v = value as any;

  switch (group) {
    case "payment":
      if (v.minimum_order < 0) issues.push({ field: "minimum_order", message: "Deve ser ≥ 0" });
      if (v.maximum_order != null && v.maximum_order < v.minimum_order)
        issues.push({ field: "maximum_order", message: "Deve ser ≥ minimum_order" });
      if (v.payment_timeout_minutes < 1 || v.payment_timeout_minutes > 120)
        issues.push({ field: "payment_timeout_minutes", message: "Entre 1 e 120" });
      if (!ALLOWED_GATEWAYS.has(v.default_gateway))
        issues.push({ field: "default_gateway", message: "Gateway inválido" });
      if (v.delivery_fee < 0) issues.push({ field: "delivery_fee", message: "Deve ser ≥ 0" });
      if (v.free_delivery_enabled && (v.free_delivery_minimum == null || v.free_delivery_minimum <= 0))
        issues.push({ field: "free_delivery_minimum", message: "Obrigatório quando frete grátis está ativo" });
      break;
    case "delivery":
      if (v.delivery_radius_km <= 0 || v.delivery_radius_km > 100)
        issues.push({ field: "delivery_radius_km", message: "Entre 0.1 e 100" });
      if (v.estimated_preparation_time < 0) issues.push({ field: "estimated_preparation_time", message: "≥ 0" });
      if (v.estimated_delivery_time < 0) issues.push({ field: "estimated_delivery_time", message: "≥ 0" });
      if (v.maximum_simultaneous_orders < 1)
        issues.push({ field: "maximum_simultaneous_orders", message: "≥ 1" });
      break;
    case "business":
      if (v.cancellation_time_limit < 0)
        issues.push({ field: "cancellation_time_limit", message: "≥ 0" });
      for (const [day, hours] of Object.entries(v.working_hours_json ?? {})) {
        if (hours == null) continue;
        const h = hours as { open?: string; close?: string };
        if (!HHMM.test(h.open ?? "") || !HHMM.test(h.close ?? ""))
          issues.push({ field: `working_hours_json.${day}`, message: "Formato HH:MM" });
      }
      break;
    case "branding":
      if (v.primary_color && !HEX.test(v.primary_color))
        issues.push({ field: "primary_color", message: "Cor hex inválida" });
      if (v.secondary_color && !HEX.test(v.secondary_color))
        issues.push({ field: "secondary_color", message: "Cor hex inválida" });
      break;
    case "notifications":
      if (!Array.isArray(v.preferred_channels_json) || v.preferred_channels_json.length === 0)
        issues.push({ field: "preferred_channels_json", message: "Selecione ao menos 1 canal" });
      break;
    case "features":
      // booleans; sem validações extras
      break;
  }
  return { valid: issues.length === 0, issues };
}
