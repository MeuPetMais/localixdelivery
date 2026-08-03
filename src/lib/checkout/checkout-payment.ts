import type { PaymentMethod } from "@/lib/payments/PricingEngine";
import {
  initialOrderStatusForPaymentMethod,
  isOfflinePaymentMethod,
  normalizeOrderPaymentMethod,
} from "./paymentMethodLabel";

export const CHECKOUT_METHODS = [
  "pix",
  "credit_card",
  "card_on_delivery",
  "card_delivery",
  "cash",
  "meal_voucher",
  "google_pay",
  "apple_pay",
] as const;

export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number];

export type CheckoutPaymentOption = {
  id: string;
  label: string;
  method: CheckoutMethod;
  online?: boolean;
};

const PRICING_METHOD_MAP: Record<CheckoutMethod, PaymentMethod> = {
  pix: "pix",
  credit_card: "credit_card",
  card_on_delivery: "cash",
  card_delivery: "cash",
  cash: "cash",
  meal_voucher: "credit_card",
  google_pay: "credit_card",
  apple_pay: "credit_card",
};

export function resolveCheckoutPayment(inputMethod: CheckoutMethod) {
  const paymentMethod = normalizeOrderPaymentMethod(inputMethod) as CheckoutMethod;
  return {
    inputMethod,
    paymentMethod,
    pricingMethod: PRICING_METHOD_MAP[paymentMethod],
    initialStatus: initialOrderStatusForPaymentMethod(paymentMethod),
    paymentRecordStatus: isOfflinePaymentMethod(paymentMethod) ? "APPROVED" : "PENDING",
  } as const;
}

export function buildCheckoutPaymentPayload(selectedOption: CheckoutPaymentOption) {
  return {
    selectedOption: {
      id: selectedOption.id,
      label: selectedOption.label,
      method: selectedOption.method,
      online: selectedOption.online === true,
    },
    selectedPaymentMethod: selectedOption.method,
    payloadPaymentMethod: selectedOption.method,
  } as const;
}
