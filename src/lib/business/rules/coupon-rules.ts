import type { BusinessRule } from "../types";

export const RULE_COUPON_ACTIVE: BusinessRule = {
  id: "COUPON_ACTIVE",
  name: "Cupom ativo",
  description: "Cupom precisa estar ativo.",
  priority: 5,
  enabled: true,
  category: "COUPON",
  evaluate(ctx) {
    if (!ctx.coupon) return { allowed: true, rule_code: "COUPON_ACTIVE", severity: "info" };
    if (!ctx.coupon.active) return { allowed: false, rule_code: "COUPON_INACTIVE", severity: "error", reason: "Cupom inativo." };
    return { allowed: true, rule_code: "COUPON_ACTIVE", severity: "info" };
  },
};

export const RULE_COUPON_EXPIRED: BusinessRule = {
  id: "COUPON_EXPIRED",
  name: "Cupom expirado",
  description: "Bloqueia cupom fora do prazo de validade.",
  priority: 10,
  enabled: true,
  category: "COUPON",
  evaluate(ctx) {
    if (!ctx.coupon?.expires_at) return { allowed: true, rule_code: "COUPON_EXPIRED", severity: "info" };
    const now = ctx.system_time ? new Date(ctx.system_time).getTime() : Date.now();
    if (new Date(ctx.coupon.expires_at).getTime() < now) {
      return { allowed: false, rule_code: "COUPON_EXPIRED", severity: "warning", reason: "Cupom expirado." };
    }
    return { allowed: true, rule_code: "COUPON_EXPIRED", severity: "info" };
  },
};

export const RULE_COUPON_MAX_USES: BusinessRule = {
  id: "COUPON_MAX_USES",
  name: "Uso máximo do cupom",
  description: "Bloqueia cupom que atingiu o limite de usos.",
  priority: 20,
  enabled: true,
  category: "COUPON",
  evaluate(ctx) {
    if (!ctx.coupon) return { allowed: true, rule_code: "COUPON_MAX_USES", severity: "info" };
    if (ctx.coupon.max_uses != null && (ctx.coupon.uses ?? 0) >= ctx.coupon.max_uses) {
      return { allowed: false, rule_code: "COUPON_MAX_USES", severity: "warning", reason: "Cupom esgotado." };
    }
    return { allowed: true, rule_code: "COUPON_MAX_USES", severity: "info" };
  },
};

export const RULE_COUPON_MIN_ORDER: BusinessRule = {
  id: "COUPON_MIN_ORDER",
  name: "Cupom exige valor mínimo",
  description: "Bloqueia cupom quando pedido está abaixo do mínimo exigido.",
  priority: 30,
  enabled: true,
  category: "COUPON",
  evaluate(ctx) {
    const min = ctx.coupon?.min_order ?? 0;
    const subtotal = ctx.order?.subtotal ?? 0;
    if (ctx.coupon && subtotal < min) {
      return { allowed: false, rule_code: "COUPON_MIN_ORDER", severity: "warning", reason: `Cupom exige pedido mínimo de R$ ${min.toFixed(2)}.` };
    }
    return { allowed: true, rule_code: "COUPON_MIN_ORDER", severity: "info" };
  },
};

export const RULE_COUPON_FIRST_PURCHASE: BusinessRule = {
  id: "COUPON_FIRST_PURCHASE",
  name: "Cupom apenas primeira compra",
  description: "Bloqueia cupom de primeira compra para clientes recorrentes.",
  priority: 40,
  enabled: true,
  category: "COUPON",
  evaluate(ctx) {
    if (ctx.coupon?.first_purchase_only && ctx.customer?.first_purchase === false) {
      return { allowed: false, rule_code: "COUPON_FIRST_PURCHASE", severity: "warning", reason: "Cupom válido apenas na primeira compra." };
    }
    return { allowed: true, rule_code: "COUPON_FIRST_PURCHASE", severity: "info" };
  },
};

export const RULE_COUPON_CATEGORY: BusinessRule = {
  id: "COUPON_CATEGORY",
  name: "Cupom por categoria",
  description: "Verifica se pedido contém categorias permitidas pelo cupom.",
  priority: 50,
  enabled: true,
  category: "COUPON",
  evaluate(ctx) {
    const allowed = ctx.coupon?.allowed_categories;
    if (!allowed?.length) return { allowed: true, rule_code: "COUPON_CATEGORY", severity: "info" };
    const inter = (ctx.coupon?.order_categories ?? []).some((c) => allowed.includes(c));
    if (!inter) {
      return { allowed: false, rule_code: "COUPON_CATEGORY", severity: "warning", reason: "Cupom não válido para as categorias do pedido." };
    }
    return { allowed: true, rule_code: "COUPON_CATEGORY", severity: "info" };
  },
};
