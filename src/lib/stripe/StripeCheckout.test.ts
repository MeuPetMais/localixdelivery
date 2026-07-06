import { describe, it, expect, beforeEach } from "vitest";
import { StripeCheckoutService } from "./StripeCheckoutService";
import { StripePaymentEventMapper } from "./StripePaymentEventMapper";
import { StripeWebhookService } from "./StripeWebhookService";
import { readStripeEnv, assertKeyMatchesMode, assertSandboxOnly } from "./env";

describe("StripeCheckoutService (validation + placeholders)", () => {
  it("valida amount inteiro > 0", async () => {
    await expect(
      StripeCheckoutService.createPaymentIntent({
        restaurantId: "r1",
        orderId: "o1",
        amount: 0,
      }),
    ).rejects.toThrow(/amount/);

    await expect(
      StripeCheckoutService.createPaymentIntent({
        restaurantId: "r1",
        orderId: "o1",
        amount: 1.5,
      }),
    ).rejects.toThrow(/amount/);
  });

  it("checkout session exige successUrl e cancelUrl", async () => {
    await expect(
      StripeCheckoutService.createCheckoutSession({
        restaurantId: "r1",
        orderId: "o1",
        amount: 1000,
        successUrl: "",
        cancelUrl: "",
      }),
    ).rejects.toThrow(/successUrl|cancelUrl/);
  });

  it("createCustomer exige email", async () => {
    await expect(
      StripeCheckoutService.createCustomer({ restaurantId: "r1", email: "" }),
    ).rejects.toThrow(/email/);
  });

  it("retrievePaymentIntent retorna null (placeholder)", async () => {
    await expect(StripeCheckoutService.retrievePaymentIntent("pi_1")).resolves.toBeNull();
  });
});

describe("StripePaymentEventMapper", () => {
  it("mapeia payment_intent.succeeded → PaymentApproved", () => {
    const out = StripePaymentEventMapper.toDomain({
      id: "evt_1",
      type: "payment_intent.succeeded",
      createdAt: new Date().toISOString(),
      livemode: false,
      data: {
        object: {
          id: "pi_1",
          amount: 1000,
          currency: "brl",
          status: "succeeded",
          metadata: { order_id: "o1", restaurant_id: "r1" },
        },
      },
    });
    expect(out?.name).toBe("PaymentApproved");
    expect(out?.payload.paymentIntentId).toBe("pi_1");
    expect(out?.payload.orderId).toBe("o1");
    expect(out?.payload.restaurantId).toBe("r1");
    expect(out?.payload.amount).toBe(1000);
  });

  it("mapeia checkout.session.completed extraindo payment_intent", () => {
    const out = StripePaymentEventMapper.toDomain({
      id: "evt_2",
      type: "checkout.session.completed",
      createdAt: new Date().toISOString(),
      livemode: false,
      data: {
        object: {
          id: "cs_1",
          payment_intent: "pi_2",
          amount_total: 2500,
          currency: "brl",
          metadata: { order_id: "o2" },
        },
      },
    });
    expect(out?.name).toBe("CheckoutCompleted");
    expect(out?.payload.checkoutSessionId).toBe("cs_1");
    expect(out?.payload.paymentIntentId).toBe("pi_2");
    expect(out?.payload.amount).toBe(2500);
  });

  it("retorna null para tipo desconhecido", () => {
    const out = StripePaymentEventMapper.toDomain({
      id: "evt_3",
      type: "invoice.created",
      createdAt: new Date().toISOString(),
      livemode: false,
      data: { object: {} },
    });
    expect(out).toBeNull();
  });

  it("cobre eventos suportados exigidos", () => {
    const t = StripePaymentEventMapper.supportedTypes();
    for (const type of [
      "payment_intent.created",
      "payment_intent.processing",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "charge.refunded",
      "checkout.session.completed",
    ]) {
      expect(t).toContain(type);
    }
  });
});

describe("StripeWebhookService — ponte com Payment Domain", () => {
  beforeEach(() => StripeWebhookService._resetPaymentHandlers());

  it("dispatch traduz evento e chama handler de pagamento", async () => {
    const seen: Array<[string, string | null]> = [];
    StripeWebhookService.onPaymentEvent((name, payload) => {
      seen.push([name, payload.orderId]);
    });

    const evt = StripeWebhookService.parse({
      id: "evt_10",
      type: "payment_intent.payment_failed",
      created: 1700000000,
      livemode: false,
      data: {
        object: {
          id: "pi_10",
          amount: 500,
          currency: "brl",
          status: "requires_payment_method",
          metadata: { order_id: "o10" },
        },
      },
    });
    await StripeWebhookService.dispatch(evt);
    expect(seen).toEqual([["PaymentFailed", "o10"]]);
  });

  it("dispatch ignora tipos não mapeados sem lançar", async () => {
    let called = false;
    StripeWebhookService.onPaymentEvent(() => {
      called = true;
    });
    const evt = StripeWebhookService.parse({
      id: "evt_11",
      type: "invoice.paid",
      created: 1700000000,
      livemode: false,
      data: { object: {} },
    });
    await expect(StripeWebhookService.dispatch(evt)).resolves.toBeUndefined();
    expect(called).toBe(false);
  });
});

describe("env — sandbox lock", () => {
  it("default é sandbox mesmo pedindo live sem ALLOW_LIVE", () => {
    const cfg = readStripeEnv({ STRIPE_MODE: "live" });
    expect(cfg.mode).toBe("sandbox");
  });

  it("permite live apenas com STRIPE_ALLOW_LIVE=true", () => {
    const cfg = readStripeEnv({ STRIPE_MODE: "live", STRIPE_ALLOW_LIVE: "true" });
    expect(cfg.mode).toBe("live");
  });

  it("assertSandboxOnly bloqueia live", () => {
    const cfg = readStripeEnv({ STRIPE_MODE: "live", STRIPE_ALLOW_LIVE: "true" });
    expect(() => assertSandboxOnly(cfg)).toThrow(/live bloqueado/);
  });

  it("assertKeyMatchesMode valida prefixo", () => {
    expect(() =>
      assertKeyMatchesMode({
        mode: "sandbox",
        secretKey: "sk_live_abc",
        publishableKey: null,
        webhookSecret: null,
        allowLive: false,
      }),
    ).toThrow(/sandbox/);

    expect(() =>
      assertKeyMatchesMode({
        mode: "sandbox",
        secretKey: "sk_test_abc",
        publishableKey: null,
        webhookSecret: null,
        allowLive: false,
      }),
    ).not.toThrow();
  });
});
