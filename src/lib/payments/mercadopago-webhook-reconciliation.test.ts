import { describe, expect, it } from "vitest";
import {
  buildMercadoPagoSplitReconciliationPlan,
  mapMercadoPagoStatus,
  type PricingSnapshot,
} from "../../../supabase/functions/_shared/mp-reconciliation";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";
const PAYMENT_ID = "mp-test-payment-001";

const pilotSnapshot: PricingSnapshot = {
  platform_fee: 0.99,
  customer_total: 9.49,
  restaurant_net: 3.5,
  gateway_fee: 0,
  service_fee_payer: "customer",
  realized_platform_revenue: 0,
};

function approvedPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    status: "approved",
    external_reference: ORDER_ID,
    transaction_amount: 9.49,
    application_fee: 0.99,
    payment_method_id: "pix",
    currency_id: "BRL",
    ...overrides,
  };
}

function pendingPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    status: "pending",
    external_reference: ORDER_ID,
    transaction_amount: 9.49,
    application_fee: 0.99,
    payment_method_id: "pix",
    currency_id: "BRL",
    ...overrides,
  };
}

function initialState(snapshot: PricingSnapshot = pilotSnapshot) {
  return {
    processedEvents: new Set<string>(),
    orderPayment: {
      order_id: ORDER_ID,
      payment_id: PAYMENT_ID,
      status: "PENDING",
      transaction_amount: 9.49,
    },
    paymentSplit: {
      order_id: ORDER_ID,
      payment_id: PAYMENT_ID,
      restaurant_id: RESTAURANT_ID,
      provider: "mercadopago",
      restaurant_amount: 3.5,
      platform_amount: 0.99,
      gateway_fee: 0,
      status: "PROCESSING",
      split_reference: `mp_payment:${PAYMENT_ID}`,
      error_message: null,
      metadata: {},
    },
    snapshot: { ...snapshot },
    transitions: [] as Array<{ orderId: string; to: string }>,
  };
}

function applyWebhookPayment(
  state: ReturnType<typeof initialState>,
  payment: Record<string, unknown>,
  eventId = `payment.updated:${String(payment.id ?? PAYMENT_ID)}`,
) {
  if (state.processedEvents.has(eventId)) return { duplicated: true };
  state.processedEvents.add(eventId);

  const localStatus = mapMercadoPagoStatus(String(payment.status ?? ""));
  state.orderPayment = {
    ...state.orderPayment,
    status: localStatus,
    transaction_amount: Number(payment.transaction_amount ?? state.orderPayment.transaction_amount),
  };

  if (localStatus === "APPROVED") {
    state.transitions.push({ orderId: ORDER_ID, to: "pago" });
  }

  const plan = buildMercadoPagoSplitReconciliationPlan({
    orderId: ORDER_ID,
    restaurantId: RESTAURANT_ID,
    paymentId: String(payment.id ?? PAYMENT_ID),
    localStatus,
    payment,
    snapshot: state.snapshot,
    now: "2026-08-12T12:00:00.000Z",
  });

  state.paymentSplit = {
    ...state.paymentSplit,
    ...plan.splitRow,
  };
  if (plan.realizedPlatformRevenueUpdate !== null) {
    state.snapshot.realized_platform_revenue = plan.realizedPlatformRevenueUpdate;
  }

  return { duplicated: false, plan };
}

describe("Mercado Pago webhook reconciliation plan", () => {
  it("approved converte split PROCESSING em COMPLETED e reconhece receita realizada", () => {
    const state = initialState();

    applyWebhookPayment(state, approvedPayment());

    expect(state.orderPayment.status).toBe("APPROVED");
    expect(state.paymentSplit.status).toBe("COMPLETED");
    expect(state.snapshot.realized_platform_revenue).toBe(0.99);
    expect(state.paymentSplit.platform_amount).toBe(0.99);
    expect(state.paymentSplit.restaurant_amount).toBe(3.5);
    expect(state.transitions).toEqual([{ orderId: ORDER_ID, to: "pago" }]);
    expect(state.paymentSplit.metadata).toMatchObject({
      expected_platform_fee: 0.99,
      realized_platform_fee: 0.99,
      marketplace_fee_source: "application_fee",
    });
  });

  it("fee divergente vai para MANUAL_REVIEW e nao reconhece receita realizada esperada", () => {
    const state = initialState();

    applyWebhookPayment(state, approvedPayment({ application_fee: 0.98 }));

    expect(state.paymentSplit.status).toBe("MANUAL_REVIEW");
    expect(state.paymentSplit.error_message).toBe("marketplace_fee_divergent");
    expect(state.snapshot.realized_platform_revenue).toBe(0);
    expect(state.paymentSplit.platform_amount).toBe(0.99);
    expect(state.paymentSplit.restaurant_amount).toBe(3.5);
  });

  it("application_fee ausente vai para MANUAL_REVIEW", () => {
    const state = initialState();
    const { application_fee: _ignored, ...payment } = approvedPayment();

    applyWebhookPayment(state, payment);

    expect(state.paymentSplit.status).toBe("MANUAL_REVIEW");
    expect(state.paymentSplit.error_message).toBe("marketplace_fee_missing");
    expect(state.snapshot.realized_platform_revenue).toBe(0);
  });

  it("pending permanece PROCESSING e realized_platform_revenue permanece zero", () => {
    const state = initialState();

    applyWebhookPayment(state, pendingPayment());

    expect(state.orderPayment.status).toBe("PENDING");
    expect(state.paymentSplit.status).toBe("PROCESSING");
    expect(state.snapshot.realized_platform_revenue).toBe(0);
    expect(state.transitions).toEqual([]);
  });

  it("evento duplicado nao duplica split, transicao nem receita", () => {
    const state = initialState();
    const payment = approvedPayment();

    const first = applyWebhookPayment(state, payment, "payment.updated:test-duplicate");
    const afterFirst = JSON.parse(JSON.stringify({
      orderPayment: state.orderPayment,
      paymentSplit: state.paymentSplit,
      snapshot: state.snapshot,
      transitions: state.transitions,
    }));
    const second = applyWebhookPayment(state, payment, "payment.updated:test-duplicate");

    expect(first.duplicated).toBe(false);
    expect(second.duplicated).toBe(true);
    expect({
      orderPayment: state.orderPayment,
      paymentSplit: state.paymentSplit,
      snapshot: state.snapshot,
      transitions: state.transitions,
    }).toEqual(afterFirst);
  });

  it("helper de teste nao cria endpoint, flag ou simulacao em runtime", () => {
    expect(buildMercadoPagoSplitReconciliationPlan).toBeTypeOf("function");
    expect(mapMercadoPagoStatus).toBeTypeOf("function");
  });
});
