// RC5.2.a.2 — EventBus interno do Delivery Assignment Domain.
// Comunicação in-process apenas; não persiste eventos.

export type DeliveryAssignmentEventName =
  | "DeliveryAssigned"
  | "DeliveryCollected"
  | "DeliveryDeparted"
  | "DeliveryDelivered"
  | "DeliveryCancelled";

export interface DeliveryAssignmentEventPayload {
  assignmentId: string;
  orderId: string;
  restaurantId: string;
  driverId: string;
  previousState: string | null;
  currentState: string;
  actor: string;
  actorId: string | null;
  reason: string | null;
  correlationId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

type Handler = (payload: DeliveryAssignmentEventPayload) => void | Promise<void>;

class DeliveryAssignmentEventBusImpl {
  private handlers = new Map<DeliveryAssignmentEventName, Set<Handler>>();

  on(event: DeliveryAssignmentEventName, handler: Handler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  async publish(event: DeliveryAssignmentEventName, payload: DeliveryAssignmentEventPayload): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    await Promise.all(Array.from(set).map((h) => Promise.resolve(h(payload))));
  }
}

export const DeliveryAssignmentEventBus = new DeliveryAssignmentEventBusImpl();

export const STATE_TO_EVENT: Record<string, DeliveryAssignmentEventName> = {
  ATRIBUIDO: "DeliveryAssigned",
  COLETANDO: "DeliveryCollected",
  EM_ROTA: "DeliveryDeparted",
  ENTREGUE: "DeliveryDelivered",
  CANCELADO: "DeliveryCancelled",
};
