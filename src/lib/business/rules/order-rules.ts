// Regras iniciais de PEDIDOS.
import { getRestaurantStatus } from "@/lib/restaurant-status";
import { getRestaurantClosedMessage } from "@/lib/restaurant-status-labels";
import type { BusinessRule } from "../types";

export const RULE_MIN_ORDER: BusinessRule = {
  id: "ORDER_MIN_VALUE",
  name: "Pedido mínimo",
  description: "Bloqueia pedido abaixo do mínimo do restaurante ou da plataforma.",
  priority: 10,
  enabled: true,
  category: "ORDER",
  evaluate(ctx) {
    const min = ctx.restaurant?.min_order ?? ctx.platform?.min_order_global ?? 0;
    const subtotal = ctx.order?.subtotal ?? 0;
    if (subtotal < min) {
      return {
        allowed: false,
        rule_code: "ORDER_MIN_VALUE",
        severity: "error",
        reason: `Pedido mínimo de R$ ${min.toFixed(2)}.`,
        metadata: { min, subtotal },
      };
    }
    return { allowed: true, rule_code: "ORDER_MIN_VALUE", severity: "info" };
  },
};

export const RULE_RESTAURANT_ACTIVE: BusinessRule = {
  id: "ORDER_RESTAURANT_ACTIVE",
  name: "Restaurante ativo",
  description: "Restaurante precisa estar ativo e não bloqueado.",
  priority: 5,
  enabled: true,
  category: "ORDER",
  evaluate(ctx) {
    if (ctx.restaurant?.blocked) {
      return { allowed: false, rule_code: "ORDER_RESTAURANT_BLOCKED", severity: "critical", reason: "Restaurante bloqueado." };
    }
    if (ctx.restaurant?.active === false) {
      return { allowed: false, rule_code: "ORDER_RESTAURANT_INACTIVE", severity: "error", reason: "Restaurante inativo." };
    }
    return { allowed: true, rule_code: "ORDER_RESTAURANT_ACTIVE", severity: "info" };
  },
};

export const RULE_RESTAURANT_OPEN: BusinessRule = {
  id: "ORDER_RESTAURANT_OPEN",
  name: "Horário de funcionamento",
  description: "Restaurante precisa estar aberto e aceitando pedidos.",
  priority: 20,
  enabled: true,
  category: "ORDER",
  evaluate(ctx) {
    const status = getRestaurantStatus(
      {
        is_open: ctx.restaurant?.is_open,
        opening_hours: ctx.restaurant?.opening_hours,
        timeZone: ctx.restaurant?.timeZone ?? ctx.restaurant?.timezone,
      },
      ctx.system_time ? new Date(ctx.system_time) : new Date(),
    );

    if (!status.isOpen) {
      return {
        allowed: false,
        rule_code: "ORDER_RESTAURANT_CLOSED",
        severity: "error",
        reason: getRestaurantClosedMessage(status.reason),
        metadata: { status_reason: status.reason },
      };
    }
    if (ctx.restaurant?.accepting_orders === false) {
      return { allowed: false, rule_code: "ORDER_NOT_ACCEPTING", severity: "error", reason: "Restaurante não está aceitando pedidos." };
    }
    return { allowed: true, rule_code: "ORDER_RESTAURANT_OPEN", severity: "info" };
  },
};

export const RULE_CUSTOMER_NOT_BLOCKED: BusinessRule = {
  id: "ORDER_CUSTOMER_NOT_BLOCKED",
  name: "Cliente não bloqueado",
  description: "Bloqueia pedidos de clientes marcados como bloqueados.",
  priority: 30,
  enabled: true,
  category: "ORDER",
  evaluate(ctx) {
    if (ctx.customer?.blocked) {
      return { allowed: false, rule_code: "ORDER_CUSTOMER_BLOCKED", severity: "critical", reason: "Cliente bloqueado." };
    }
    return { allowed: true, rule_code: "ORDER_CUSTOMER_NOT_BLOCKED", severity: "info" };
  },
};

export const RULE_DUPLICATE_ORDER: BusinessRule = {
  id: "ORDER_DUPLICATE",
  name: "Pedido duplicado",
  description: "Impede criação de pedido idêntico em janela curta.",
  priority: 40,
  enabled: true,
  category: "ORDER",
  evaluate(ctx) {
    if (ctx.order?.duplicate_of) {
      return {
        allowed: false,
        rule_code: "ORDER_DUPLICATE",
        severity: "warning",
        reason: "Pedido duplicado detectado.",
        metadata: { duplicate_of: ctx.order.duplicate_of },
      };
    }
    return { allowed: true, rule_code: "ORDER_DUPLICATE", severity: "info" };
  },
};

export const RULE_PAYMENT_MAX_WAIT: BusinessRule = {
  id: "ORDER_PAYMENT_MAX_WAIT",
  name: "Tempo máximo para pagamento",
  description: "Expira pedidos aguardando pagamento além do limite.",
  priority: 60,
  enabled: true,
  category: "ORDER",
  evaluate(ctx) {
    const s = ctx.payment?.seconds_since_created ?? 0;
    const max = ctx.payment?.max_wait_seconds ?? 30 * 60;
    if (s > max) {
      return { allowed: false, rule_code: "ORDER_PAYMENT_MAX_WAIT", severity: "warning", reason: "Tempo de pagamento expirado.", metadata: { s, max } };
    }
    return { allowed: true, rule_code: "ORDER_PAYMENT_MAX_WAIT", severity: "info" };
  },
};
