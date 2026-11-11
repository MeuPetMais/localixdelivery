import { describe, it, expect } from "vitest";
import { stripeEventObject } from "./StripePaymentEventMapper";
describe("Stripe event object boundary", () => {
  it("preserves identifiers, amounts and metadata", () => {
    const object = {
      id: "pi_1",
      amount: 2050,
      currency: "brl",
      metadata: { order_id: "order" },
      status: "succeeded",
    };
    expect(stripeEventObject({ object })).toEqual(object);
  });
  it("rejects malformed identifiers instead of passing objects to payment consumers", () => {
    expect(() => stripeEventObject({ object: { id: { unexpected: true } } })).toThrow();
  });
});

import { StripePaymentEventMapper } from "./StripePaymentEventMapper";
it("maps nullable Checkout Session totals and currency without rejecting the event", () => {
  const result = StripePaymentEventMapper.toDomain({
    id: "evt_nullable",
    type: "checkout.session.completed",
    createdAt: new Date("2026-11-09T15:00:00Z").toISOString(),
    livemode: false,
    data: {
      object: {
        id: "cs_1",
        payment_intent: null,
        amount_total: null,
        currency: null,
        status: "complete",
      },
    },
  });
  expect(result?.payload).toMatchObject({
    checkoutSessionId: "cs_1",
    paymentIntentId: null,
    amount: null,
    currency: "brl",
  });
});
it.each([{ amount_total: "5000" }, { currency: 42 }, { id: {} }, { payment_intent: 99 }])(
  "rejects invalid field types %j",
  (object) => {
    expect(() => stripeEventObject({ object })).toThrow();
  },
);
