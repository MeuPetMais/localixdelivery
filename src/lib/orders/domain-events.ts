// Domain Events do ciclo de vida do pedido.
// Publicados via OrderEventBus (isolado do EventBus de pagamentos).
import type { OrderState } from "./OrderStateMachine";
import type { OrderActorType } from "./OrderPermissions";

export type OrderDomainEventName =
  | "OrderCreated"
  | "OrderWaitingPayment"
  | "PaymentApproved"
  | "PaymentFailed"
  | "RestaurantAccepted"
  | "RestaurantRejected"
  | "PreparingStarted"
  | "OrderReady"
  | "DeliveryStarted"
  | "OrderDelivered"
  | "OrderCompleted"
  | "OrderCancelled"
  | "OrderRefunded"
  | "ChargebackReceived";

export const STATE_TO_EVENT: Record<OrderState, OrderDomainEventName> = {
  CREATED: "OrderCreated",
  WAITING_PAYMENT: "OrderWaitingPayment",
  PAYMENT_APPROVED: "PaymentApproved",
  PAYMENT_FAILED: "PaymentFailed",
  RESTAURANT_ACCEPTED: "RestaurantAccepted",
  RESTAURANT_REJECTED: "RestaurantRejected",
  PREPARING: "PreparingStarted",
  READY: "OrderReady",
  OUT_FOR_DELIVERY: "DeliveryStarted",
  DELIVERED: "OrderDelivered",
  COMPLETED: "OrderCompleted",
  CANCELLED: "OrderCancelled",
  REFUNDED: "OrderRefunded",
  CHARGEBACK: "ChargebackReceived",
};

export interface OrderDomainEventPayload {
  orderId: string;
  restaurantId: string | null;
  previousStatus: OrderState | null;
  currentStatus: OrderState;
  actorType: OrderActorType;
  performedBy: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export type OrderDomainEventHandler = (
  name: OrderDomainEventName,
  payload: OrderDomainEventPayload,
) => void | Promise<void>;

const handlers = new Set<OrderDomainEventHandler>();

export const OrderEventBus = {
  subscribe(h: OrderDomainEventHandler): () => void {
    handlers.add(h);
    return () => handlers.delete(h);
  },
  async publish(name: OrderDomainEventName, payload: OrderDomainEventPayload) {
    for (const h of handlers) {
      try {
        await h(name, payload);
      } catch (err) {
        console.error("[OrderEventBus] handler falhou", name, err);
      }
    }
  },
  _reset() {
    handlers.clear();
  },
};
