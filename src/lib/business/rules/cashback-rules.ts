import type { BusinessRule } from "../types";

export const RULE_CASHBACK_ELIGIBLE: BusinessRule = {
  id: "CASHBACK_ELIGIBLE",
  name: "Cashback elegível",
  description: "Cliente precisa estar elegível para receber cashback.",
  priority: 10,
  enabled: true,
  category: "LOYALTY",
  evaluate(ctx) {
    if (!ctx.cashback) return { allowed: true, rule_code: "CASHBACK_ELIGIBLE", severity: "info" };
    if (!ctx.cashback.eligible) {
      return { allowed: false, rule_code: "CASHBACK_NOT_ELIGIBLE", severity: "warning", reason: "Cliente não elegível para cashback." };
    }
    return { allowed: true, rule_code: "CASHBACK_ELIGIBLE", severity: "info" };
  },
};

export const RULE_CASHBACK_MAX: BusinessRule = {
  id: "CASHBACK_MAX",
  name: "Cashback máximo",
  description: "Valor de cashback não pode ultrapassar teto.",
  priority: 20,
  enabled: true,
  category: "LOYALTY",
  evaluate(ctx) {
    if (!ctx.cashback) return { allowed: true, rule_code: "CASHBACK_MAX", severity: "info" };
    const max = ctx.cashback.max_amount ?? Infinity;
    if ((ctx.cashback.amount ?? 0) > max) {
      return { allowed: false, rule_code: "CASHBACK_MAX", severity: "warning", reason: `Cashback excede o teto de R$ ${max.toFixed(2)}.` };
    }
    return { allowed: true, rule_code: "CASHBACK_MAX", severity: "info" };
  },
};

export const RULE_CASHBACK_VALID: BusinessRule = {
  id: "CASHBACK_VALID",
  name: "Cashback dentro da validade",
  description: "Cashback precisa estar dentro do prazo.",
  priority: 30,
  enabled: true,
  category: "LOYALTY",
  evaluate(ctx) {
    if (!ctx.cashback?.expires_at) return { allowed: true, rule_code: "CASHBACK_VALID", severity: "info" };
    const now = ctx.system_time ? new Date(ctx.system_time).getTime() : Date.now();
    if (new Date(ctx.cashback.expires_at).getTime() < now) {
      return { allowed: false, rule_code: "CASHBACK_EXPIRED", severity: "warning", reason: "Cashback expirado." };
    }
    return { allowed: true, rule_code: "CASHBACK_VALID", severity: "info" };
  },
};

export const RULE_CASHBACK_STACKABLE: BusinessRule = {
  id: "CASHBACK_STACKABLE",
  name: "Cashback acumulável com cupom",
  description: "Bloqueia acúmulo quando não permitido.",
  priority: 40,
  enabled: true,
  category: "LOYALTY",
  evaluate(ctx) {
    if (ctx.cashback && ctx.coupon && ctx.cashback.stackable === false) {
      return { allowed: false, rule_code: "CASHBACK_NOT_STACKABLE", severity: "warning", reason: "Cashback não acumulável com cupom." };
    }
    return { allowed: true, rule_code: "CASHBACK_STACKABLE", severity: "info" };
  },
};
