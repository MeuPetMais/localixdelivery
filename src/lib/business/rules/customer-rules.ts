import type { BusinessRule } from "../types";

export const RULE_CUSTOMER_ACTIVE: BusinessRule = {
  id: "CUSTOMER_ACTIVE",
  name: "Conta ativa",
  description: "Cliente precisa ter conta ativa.",
  priority: 5,
  enabled: true,
  category: "CUSTOMER",
  evaluate(ctx) {
    if (ctx.customer?.active === false) {
      return { allowed: false, rule_code: "CUSTOMER_INACTIVE", severity: "error", reason: "Conta inativa." };
    }
    return { allowed: true, rule_code: "CUSTOMER_ACTIVE", severity: "info" };
  },
};

export const RULE_CUSTOMER_PHONE_CONFIRMED: BusinessRule = {
  id: "CUSTOMER_PHONE_CONFIRMED",
  name: "Telefone confirmado",
  description: "Telefone precisa estar confirmado.",
  priority: 10,
  enabled: true,
  category: "CUSTOMER",
  evaluate(ctx) {
    if (ctx.customer && ctx.customer.phone_confirmed === false) {
      return { allowed: false, rule_code: "CUSTOMER_PHONE_UNCONFIRMED", severity: "warning", reason: "Telefone não confirmado." };
    }
    return { allowed: true, rule_code: "CUSTOMER_PHONE_CONFIRMED", severity: "info" };
  },
};

export const RULE_CUSTOMER_EMAIL_CONFIRMED: BusinessRule = {
  id: "CUSTOMER_EMAIL_CONFIRMED",
  name: "Email confirmado",
  description: "Email precisa estar confirmado quando exigido.",
  priority: 20,
  enabled: false,
  category: "CUSTOMER",
  evaluate(ctx) {
    if (ctx.customer && ctx.customer.email_confirmed === false) {
      return { allowed: false, rule_code: "CUSTOMER_EMAIL_UNCONFIRMED", severity: "warning", reason: "Email não confirmado." };
    }
    return { allowed: true, rule_code: "CUSTOMER_EMAIL_CONFIRMED", severity: "info" };
  },
};

export const RULE_CUSTOMER_DAILY_LIMIT: BusinessRule = {
  id: "CUSTOMER_DAILY_LIMIT",
  name: "Limite diário de pedidos",
  description: "Cliente não pode exceder limite diário.",
  priority: 30,
  enabled: true,
  category: "CUSTOMER",
  evaluate(ctx) {
    const limit = 20;
    if ((ctx.customer?.daily_orders ?? 0) >= limit) {
      return { allowed: false, rule_code: "CUSTOMER_DAILY_LIMIT", severity: "warning", reason: "Limite diário de pedidos atingido." };
    }
    return { allowed: true, rule_code: "CUSTOMER_DAILY_LIMIT", severity: "info" };
  },
};
