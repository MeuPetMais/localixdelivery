// Billing Domain — Taxa de serviço (BD-003: R$0,99 por pedido confirmado).
// Puro. Não altera PricingEngine — apenas expõe a política oficial.

import type { ServiceFeeQuote } from "./types";
import { BillingEvents } from "./BillingEvents";

const PER_ORDER_FEE = 0.99;

export const ServiceFeeService = {
  quote(restaurantId: string): ServiceFeeQuote {
    BillingEvents.emit({
      type: "ServiceFeeQuoted",
      restaurantId,
      perOrderFee: PER_ORDER_FEE,
      at: new Date().toISOString(),
    });
    return { perOrderFee: PER_ORDER_FEE, currency: "BRL", appliesTo: "confirmed_order" };
  },
  calculate(orderCount: number): number {
    if (orderCount < 0) return 0;
    return Number((orderCount * PER_ORDER_FEE).toFixed(2));
  },
};
