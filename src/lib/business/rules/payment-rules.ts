import type { BusinessRule } from "../types";

export const RULE_PAYMENT_APPROVED: BusinessRule = {
  id: "PAY_APPROVED",
  name: "Pagamento aprovado",
  description: "Confirma que pagamento está aprovado.",
  priority: 10,
  enabled: true,
  category: "PAYMENT",
  evaluate(ctx) {
    if (ctx.payment?.status === "approved") {
      return { allowed: true, rule_code: "PAY_APPROVED", severity: "info" };
    }
    return { allowed: false, rule_code: "PAY_NOT_APPROVED", severity: "warning", reason: "Pagamento não está aprovado." };
  },
};

export const RULE_PAYMENT_NOT_REJECTED: BusinessRule = {
  id: "PAY_NOT_REJECTED",
  name: "Pagamento não recusado",
  description: "Bloqueia se o pagamento foi recusado, expirado, estornado ou chargeback.",
  priority: 5,
  enabled: true,
  category: "PAYMENT",
  evaluate(ctx) {
    const s = ctx.payment?.status;
    if (s === "rejected") return { allowed: false, rule_code: "PAY_REJECTED", severity: "error", reason: "Pagamento recusado." };
    if (s === "expired") return { allowed: false, rule_code: "PAY_EXPIRED", severity: "warning", reason: "Pagamento expirado." };
    if (s === "refunded") return { allowed: false, rule_code: "PAY_REFUNDED", severity: "warning", reason: "Pagamento estornado." };
    if (s === "chargeback") return { allowed: false, rule_code: "PAY_CHARGEBACK", severity: "critical", reason: "Chargeback recebido." };
    return { allowed: true, rule_code: "PAY_NOT_REJECTED", severity: "info" };
  },
};

export const RULE_MP_CONNECTED: BusinessRule = {
  id: "PAY_MP_CONNECTED",
  name: "Conta Mercado Pago conectada",
  description: "Restaurante precisa ter Mercado Pago conectado e token válido.",
  priority: 1,
  enabled: true,
  category: "PAYMENT",
  evaluate(ctx) {
    if (!ctx.payment?.mp_connected) {
      return { allowed: false, rule_code: "PAY_MP_NOT_CONNECTED", severity: "critical", reason: "Mercado Pago não conectado." };
    }
    if (ctx.payment?.mp_token_valid === false) {
      return { allowed: false, rule_code: "PAY_MP_TOKEN_INVALID", severity: "critical", reason: "Token Mercado Pago inválido." };
    }
    return { allowed: true, rule_code: "PAY_MP_CONNECTED", severity: "info" };
  },
};
