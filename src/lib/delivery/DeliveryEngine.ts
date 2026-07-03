import type { DeliveryContext, DeliveryOrder, DeliveryState, DispatchStrategy, Driver } from "./types";
import { canTransition, isTerminal } from "./DeliveryStateMachine";
import { deliveryEventBus, type DeliveryEventType } from "./DeliveryEventBus";
import { dispatchEngine } from "./DispatchEngine";
import { getDeliveryProvider } from "./providers";

export interface DeliveryRepository {
  create(input: Omit<DeliveryOrder, "id">): Promise<DeliveryOrder>;
  update(id: string, patch: Partial<DeliveryOrder>): Promise<DeliveryOrder>;
  get(id: string): Promise<DeliveryOrder | null>;
  appendTimeline(id: string, entry: {
    event: string; from_status?: string | null; to_status?: string | null;
    actor?: string | null; metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface CreateDeliveryInput {
  order_id: string;
  restaurant_id: string;
  strategy: DispatchStrategy;
  context: DeliveryContext;
  restaurantHasOwnFleet: boolean;
  drivers?: Driver[];
  metadata?: Record<string, unknown>;
}

export class DeliveryEngine {
  constructor(private readonly repo: DeliveryRepository) {}

  async createDelivery(input: CreateDeliveryInput): Promise<DeliveryOrder> {
    const decision = await dispatchEngine.choose({
      strategy: input.strategy,
      context: input.context,
      restaurantHasOwnFleet: input.restaurantHasOwnFleet,
      drivers: input.drivers,
    });

    const providerImpl = getDeliveryProvider(decision.provider);
    const created = await providerImpl.createDelivery(input.context);
    if (!created.accepted) {
      throw new Error(created.reason ?? "provider rejected delivery");
    }

    const now = new Date().toISOString();
    const eta = decision.estimate?.eta_minutes ?? 30;
    const order = await this.repo.create({
      order_id: input.order_id,
      restaurant_id: input.restaurant_id,
      provider: decision.provider,
      delivery_mode: input.strategy,
      driver_id: decision.driver?.id ?? null,
      status: decision.driver ? "ASSIGNED" : "WAITING_ASSIGNMENT",
      estimated_pickup: new Date(Date.now() + 10 * 60_000).toISOString(),
      estimated_delivery: new Date(Date.now() + eta * 60_000).toISOString(),
      started_at: null,
      finished_at: null,
      metadata: { ...(input.metadata ?? {}), dispatch: decision.reason, external_id: created.external_id },
    });

    if (decision.driver) {
      await this.repo.appendTimeline(order.id, {
        event: "DriverAssigned",
        from_status: "WAITING_ASSIGNMENT",
        to_status: "ASSIGNED",
        actor: "system",
        metadata: { driver_id: decision.driver.id },
      });
      await deliveryEventBus.emit({
        type: "DriverAssigned",
        delivery_id: order.id,
        order_id: order.order_id,
        driver_id: decision.driver.id,
        emitted_at: now,
      });
    }
    return order;
  }

  async assignDriver(deliveryId: string, driverId: string, actor = "system"): Promise<DeliveryOrder> {
    return this.transition(deliveryId, "ASSIGNED", {
      actor,
      event: "DriverChanged",
      patch: { driver_id: driverId },
      metadata: { driver_id: driverId },
    });
  }

  async transition(
    deliveryId: string,
    to: DeliveryState,
    opts: {
      actor?: string;
      event?: DeliveryEventType | string;
      patch?: Partial<DeliveryOrder>;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<DeliveryOrder> {
    const current = await this.repo.get(deliveryId);
    if (!current) throw new Error(`delivery ${deliveryId} not found`);
    if (isTerminal(current.status)) throw new Error(`delivery ${deliveryId} is terminal`);
    if (current.status !== to && !canTransition(current.status, to)) {
      throw new Error(`invalid transition ${current.status} → ${to}`);
    }

    const patch: Partial<DeliveryOrder> = { status: to, ...(opts.patch ?? {}) };
    if (to === "PICKED_UP" && !current.started_at) patch.started_at = new Date().toISOString();
    if ((to === "DELIVERED" || to === "CANCELLED" || to === "FAILED" || to === "RETURNED") && !current.finished_at) {
      patch.finished_at = new Date().toISOString();
    }
    const updated = await this.repo.update(deliveryId, patch);

    const event = opts.event ?? mapStateToEvent(to);
    await this.repo.appendTimeline(deliveryId, {
      event,
      from_status: current.status,
      to_status: to,
      actor: opts.actor ?? "system",
      metadata: opts.metadata,
    });

    if (isDeliveryEventType(event)) {
      await deliveryEventBus.emit({
        type: event,
        delivery_id: deliveryId,
        order_id: current.order_id,
        driver_id: updated.driver_id,
        emitted_at: new Date().toISOString(),
        payload: opts.metadata,
      });
    }
    return updated;
  }

  async cancel(deliveryId: string, reason?: string, actor = "system"): Promise<DeliveryOrder> {
    const current = await this.repo.get(deliveryId);
    if (!current) throw new Error("delivery not found");
    const providerImpl = getDeliveryProvider(current.provider);
    await providerImpl.cancelDelivery(deliveryId, reason);
    return this.transition(deliveryId, "CANCELLED", {
      actor,
      event: "DeliveryCancelled",
      metadata: { reason },
    });
  }
}

const STATE_EVENT_MAP: Partial<Record<DeliveryState, DeliveryEventType>> = {
  ASSIGNED: "DriverAssigned",
  GOING_TO_RESTAURANT: "PickupStarted",
  WAITING_PICKUP: "DriverArrived",
  PICKED_UP: "OrderPickedUp",
  ON_THE_WAY: "DeliveryStarted",
  ARRIVED: "DriverNearCustomer",
  DELIVERED: "OrderDelivered",
  CANCELLED: "DeliveryCancelled",
  FAILED: "DeliveryFailed",
};

function mapStateToEvent(s: DeliveryState): DeliveryEventType | string {
  return STATE_EVENT_MAP[s] ?? `Delivery:${s}`;
}

const KNOWN_EVENTS = new Set<DeliveryEventType>([
  "DriverAssigned", "DriverChanged", "DriverArrived", "PickupStarted", "OrderPickedUp",
  "DeliveryStarted", "DriverNearCustomer", "OrderDelivered", "DeliveryCancelled", "DeliveryFailed",
]);
function isDeliveryEventType(v: string): v is DeliveryEventType {
  return KNOWN_EVENTS.has(v as DeliveryEventType);
}
