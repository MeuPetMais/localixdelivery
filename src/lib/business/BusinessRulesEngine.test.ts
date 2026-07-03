import { describe, it, expect, beforeEach } from "vitest";
import { BusinessRulesEngine } from "./BusinessRulesEngine";
import { BusinessRuleRegistry } from "./BusinessRuleRegistry";
import { registerDefaultRules } from "./rules";
import type { BusinessRuleContext } from "./types";

function makeEngine() {
  const reg = new BusinessRuleRegistry();
  registerDefaultRules(reg);
  return new BusinessRulesEngine(reg);
}

const baseRestaurant = {
  id: "r1",
  active: true,
  blocked: false,
  accepting_orders: true,
  is_open: true,
  min_order: 20,
};

describe("BusinessRulesEngine — ORDER", () => {
  let engine: BusinessRulesEngine;
  beforeEach(() => {
    engine = makeEngine();
    engine.executor.clearCache();
  });

  it("bloqueia pedido abaixo do mínimo", async () => {
    const ctx: BusinessRuleContext = {
      restaurant: baseRestaurant,
      order: { subtotal: 10 },
    };
    const d = await engine.evaluate("ORDER", ctx);
    expect(d.allowed).toBe(false);
    expect(d.rule_code).toBe("ORDER_MIN_VALUE");
  });

  it("bloqueia restaurante fechado", async () => {
    const ctx: BusinessRuleContext = {
      restaurant: { ...baseRestaurant, is_open: false },
      order: { subtotal: 50 },
    };
    const d = await engine.evaluate("ORDER", ctx);
    expect(d.allowed).toBe(false);
    expect(d.rule_code).toBe("ORDER_RESTAURANT_CLOSED");
  });

  it("bloqueia cliente bloqueado", async () => {
    const ctx: BusinessRuleContext = {
      restaurant: baseRestaurant,
      order: { subtotal: 50 },
      customer: { id: "c1", blocked: true },
    };
    const d = await engine.evaluate("ORDER", ctx);
    expect(d.allowed).toBe(false);
    expect(d.rule_code).toBe("ORDER_CUSTOMER_BLOCKED");
  });

  it("aprova pedido válido", async () => {
    const ctx: BusinessRuleContext = {
      restaurant: baseRestaurant,
      order: { subtotal: 50 },
      customer: { id: "c1", blocked: false, active: true },
      payment: { seconds_since_created: 10, max_wait_seconds: 1800 },
    };
    const d = await engine.evaluate("ORDER", ctx);
    expect(d.allowed).toBe(true);
  });
});

describe("BusinessRulesEngine — COUPON", () => {
  it("bloqueia cupom expirado", async () => {
    const engine = makeEngine();
    engine.executor.clearCache();
    const d = await engine.evaluate("COUPON", {
      coupon: { code: "X", active: true, expires_at: new Date(Date.now() - 1000).toISOString() },
    });
    expect(d.allowed).toBe(false);
    expect(d.rule_code).toBe("COUPON_EXPIRED");
  });
});

describe("BusinessRulesEngine — PAYMENT", () => {
  it("bloqueia pagamento expirado", async () => {
    const engine = makeEngine();
    engine.executor.clearCache();
    const d = await engine.evaluate("PAYMENT", {
      payment: { mp_connected: true, mp_token_valid: true, status: "expired" },
    });
    expect(d.allowed).toBe(false);
    expect(d.rule_code).toBe("PAY_EXPIRED");
  });

  it("bloqueia token Mercado Pago inválido", async () => {
    const engine = makeEngine();
    engine.executor.clearCache();
    const d = await engine.evaluate("PAYMENT", {
      payment: { mp_connected: true, mp_token_valid: false, status: "approved" },
    });
    expect(d.allowed).toBe(false);
    expect(d.rule_code).toBe("PAY_MP_TOKEN_INVALID");
  });
});

describe("BusinessRulesEngine — DELIVERY", () => {
  it("bloqueia área não atendida", async () => {
    const engine = makeEngine();
    engine.executor.clearCache();
    const d = await engine.evaluate("DELIVERY", {
      delivery: { available: true, inside_service_area: false },
    });
    expect(d.allowed).toBe(false);
    expect(d.rule_code).toBe("DELIVERY_OUT_OF_AREA");
  });
});
