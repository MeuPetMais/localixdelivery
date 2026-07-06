// Stripe → PaymentService — Payment Event Mapper.
// Traduz eventos brutos do Stripe para o vocabulário do Payment Domain,
// sem que qualquer consumidor externo precise conhecer o formato Stripe.
//
// Fluxo:
//   Stripe webhook → StripeWebhookService.parse
//                 → StripePaymentEventMapper.toDomain
//                 → (futuro) PaymentService entrega ao Payment Domain

import type { StripeWebhookEvent } from "./types";

export type DomainPaymentEvent =
  | "PaymentCreated"
  | "PaymentProcessing"
  | "PaymentApproved"
  | "PaymentFailed"
  | "PaymentRefunded"
  | "PaymentCancelled"
  | "CheckoutCompleted";

export interface DomainPaymentPayload {
  provider: "stripe";
  eventId: string;
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
  orderId: string | null;
  restaurantId: string | null;
  amount: number | null;
  currency: string;
  status: string | null;
  raw: Record<string, unknown>;
}

const TYPE_TO_DOMAIN: Record<string, DomainPaymentEvent> = {
  "payment_intent.created": "PaymentCreated",
  "payment_intent.processing": "PaymentProcessing",
  "payment_intent.succeeded": "PaymentApproved",
  "payment_intent.payment_failed": "PaymentFailed",
  "payment_intent.canceled": "PaymentCancelled",
  "charge.refunded": "PaymentRefunded",
  "checkout.session.completed": "CheckoutCompleted",
};

function pickMetadata(obj: any, key: string): string | null {
  const m = obj?.metadata;
  return m && typeof m[key] === "string" ? m[key] : null;
}

export const StripePaymentEventMapper = {
  supportedTypes(): string[] {
    return Object.keys(TYPE_TO_DOMAIN);
  },

  isSupported(stripeType: string): boolean {
    return stripeType in TYPE_TO_DOMAIN;
  },

  toDomain(event: StripeWebhookEvent): { name: DomainPaymentEvent; payload: DomainPaymentPayload } | null {
    const name = TYPE_TO_DOMAIN[event.type];
    if (!name) return null;

    const obj = (event.data as any)?.object ?? {};
    const isCheckout = event.type === "checkout.session.completed";

    return {
      name,
      payload: {
        provider: "stripe",
        eventId: event.id,
        paymentIntentId: isCheckout ? obj.payment_intent ?? null : obj.id ?? null,
        checkoutSessionId: isCheckout ? obj.id ?? null : null,
        orderId: pickMetadata(obj, "order_id"),
        restaurantId: pickMetadata(obj, "restaurant_id"),
        amount: typeof obj.amount === "number" ? obj.amount : typeof obj.amount_total === "number" ? obj.amount_total : null,
        currency: String(obj.currency ?? "brl"),
        status: obj.status ?? null,
        raw: obj as Record<string, unknown>,
      },
    };
  },
};

export default StripePaymentEventMapper;
