// Ponte com o EventBus (pagamentos) e OrderEventBus (pedidos).
// Mapeia eventos de domínio → template code (IN_APP).
import { EventBus, type PaymentEventName, type PaymentEventPayload } from "@/lib/payments/EventBus";
import { OrderEventBus, type OrderDomainEventName, type OrderDomainEventPayload } from "@/lib/orders/domain-events";
import type { NotificationRequest } from "./types";

const ORDER_EVENT_TO_TEMPLATE: Partial<Record<OrderDomainEventName, string>> = {
  OrderCreated: "ORDER_CREATED",
  RestaurantAccepted: "ORDER_ACCEPTED",
  RestaurantRejected: "ORDER_REJECTED",
  PreparingStarted: "ORDER_PREPARING",
  OrderReady: "ORDER_READY",
  DeliveryStarted: "OUT_FOR_DELIVERY",
  OrderDelivered: "ORDER_DELIVERED",
  OrderCancelled: "ORDER_CANCELLED",
  OrderRefunded: "REFUND_CREATED",
};

const PAYMENT_EVENT_TO_TEMPLATE: Partial<Record<PaymentEventName, string>> = {
  PaymentApproved: "PAYMENT_APPROVED",
  PaymentRejected: "PAYMENT_FAILED",
  PaymentExpired: "PAYMENT_EXPIRED",
  PaymentRefunded: "REFUND_CREATED",
  SplitCompleted: "PAYMENT_APPROVED",
};

export function orderEventToRequest(
  name: OrderDomainEventName,
  payload: OrderDomainEventPayload,
): NotificationRequest | null {
  const code = ORDER_EVENT_TO_TEMPLATE[name];
  if (!code) return null;
  return {
    recipient_id: null,
    recipient_type: "customer",
    channel: "IN_APP",
    template_code: code,
    priority: name === "OrderCancelled" || name === "OrderRefunded" ? "HIGH" : "NORMAL",
    payload: {
      order_id: payload.orderId,
      restaurant_id: payload.restaurantId,
      order_number: payload.metadata?.order_number,
      ...payload.metadata,
    },
    origin: `order:${name}`,
  };
}

export function paymentEventToRequest(
  name: PaymentEventName,
  payload: PaymentEventPayload,
): NotificationRequest | null {
  const code = PAYMENT_EVENT_TO_TEMPLATE[name];
  if (!code) return null;
  return {
    recipient_id: null,
    recipient_type: "customer",
    channel: "IN_APP",
    template_code: code,
    priority: name === "PaymentRejected" ? "HIGH" : "NORMAL",
    payload: {
      order_id: payload.orderId,
      restaurant_id: payload.restaurantId,
      payment_id: payload.paymentId,
      amount: payload.amount,
    },
    origin: `payment:${name}`,
  };
}

/**
 * Registra o consumo dos EventBus. `enqueue` deve apenas
 * inserir na fila (não envia). Retorna função para desinscrever.
 */
export function bindNotificationCenterToBuses(
  enqueue: (req: NotificationRequest) => Promise<void>,
): () => void {
  const off1 = OrderEventBus.subscribe(async (name, payload) => {
    const req = orderEventToRequest(name, payload);
    if (req) await enqueue(req);
  });
  const off2 = EventBus.subscribe(async (name, payload) => {
    const req = paymentEventToRequest(name, payload);
    if (req) await enqueue(req);
  });
  return () => {
    off1();
    off2();
  };
}
