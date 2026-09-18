import { describe, expect, it } from "vitest";
import { validateTrustedMpPaymentContext, type TrustedMpContext } from "./trust-boundary";

const orderId = "11111111-1111-4111-8111-111111111111";
const restaurantId = "22222222-2222-4222-8222-222222222222";

function valid(): TrustedMpContext {
  return {
    resourceId: "123",
    mp: {
      id: "123",
      status: "refunded",
      transaction_amount: 10,
      currency_id: "BRL",
      external_reference: orderId,
      collector_id: "seller-1",
    },
    order: { id: orderId, restaurant_id: restaurantId },
    orderPayment: {
      order_id: orderId,
      restaurant_id: restaurantId,
      payment_id: "123",
      transaction_amount: 10,
    },
    snapshot: { order_id: orderId, customer_total: 10, currency: "BRL" },
    restaurant: { id: restaurantId },
    account: { restaurant_id: restaurantId, mp_user_id: "seller-1", connected: true },
  };
}

describe("deployed mp-webhook trust boundary", () => {
  it("accepts the trusted payment context", () => {
    expect(validateTrustedMpPaymentContext(valid())).toMatchObject({
      ok: true,
      orderId,
      restaurantId,
      amount: 10,
    });
  });

  it.each([
    [
      "payment id",
      (v: TrustedMpContext) => {
        v.mp!.id = "other";
      },
      "mp_id_mismatch",
    ],
    [
      "external reference",
      (v: TrustedMpContext) => {
        v.mp!.external_reference = "other";
      },
      "mp_external_reference_mismatch",
    ],
    [
      "seller",
      (v: TrustedMpContext) => {
        v.mp!.collector_id = "other";
      },
      "mp_seller_mismatch",
    ],
    [
      "order",
      (v: TrustedMpContext) => {
        v.order!.id = "other";
      },
      "mp_external_reference_mismatch",
    ],
    [
      "order payment",
      (v: TrustedMpContext) => {
        v.orderPayment!.payment_id = "other";
      },
      "order_payment_payment_id_mismatch",
    ],
    [
      "snapshot",
      (v: TrustedMpContext) => {
        v.snapshot!.order_id = "other";
      },
      "snapshot_order_mismatch",
    ],
    [
      "amount",
      (v: TrustedMpContext) => {
        v.mp!.transaction_amount = 11;
      },
      "amount_mismatch",
    ],
    [
      "currency",
      (v: TrustedMpContext) => {
        v.mp!.currency_id = "USD";
      },
      "currency_mismatch",
    ],
    [
      "status",
      (v: TrustedMpContext) => {
        v.mp!.status = "unknown";
      },
      "invalid_mp_status",
    ],
  ] as const)("rejects incompatible %s", (_name, mutate, reason) => {
    const context = valid();
    mutate(context);
    expect(validateTrustedMpPaymentContext(context)).toEqual({ ok: false, reason });
  });
});
