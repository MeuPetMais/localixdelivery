export type DeliveryEventType =
  | "DriverAssigned"
  | "DriverChanged"
  | "DriverArrived"
  | "PickupStarted"
  | "OrderPickedUp"
  | "DeliveryStarted"
  | "DriverNearCustomer"
  | "OrderDelivered"
  | "DeliveryCancelled"
  | "DeliveryFailed";

export interface DeliveryEvent<P = unknown> {
  type: DeliveryEventType;
  delivery_id: string;
  order_id?: string;
  driver_id?: string | null;
  payload?: P;
  emitted_at: string;
}

type Handler = (e: DeliveryEvent) => void | Promise<void>;

class DeliveryEventBus {
  private handlers = new Map<DeliveryEventType, Set<Handler>>();

  on(type: DeliveryEventType, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  async emit(event: DeliveryEvent) {
    const list = this.handlers.get(event.type);
    if (!list) return;
    await Promise.all(Array.from(list).map((h) => Promise.resolve(h(event)).catch(() => {})));
  }

  clear() {
    this.handlers.clear();
  }
}

export const deliveryEventBus = new DeliveryEventBus();
