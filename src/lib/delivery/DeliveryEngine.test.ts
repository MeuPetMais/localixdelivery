import { describe, it, expect, beforeEach } from "vitest";
import { DeliveryEngine, type DeliveryRepository } from "./DeliveryEngine";
import { deliveryEventBus, type DeliveryEvent } from "./DeliveryEventBus";
import { canTransition, isTerminal } from "./DeliveryStateMachine";
import { pickBestDriver, rankDrivers } from "./AssignmentEngine";
import { calculateETA, haversineKm } from "./ETAEngine";
import { TrackingService } from "./TrackingService";
import { dispatchEngine } from "./DispatchEngine";
import type { DeliveryOrder, Driver } from "./types";

function makeRepo(): DeliveryRepository & { store: Map<string, DeliveryOrder>; timeline: any[] } {
  const store = new Map<string, DeliveryOrder>();
  const timeline: any[] = [];
  return {
    store,
    timeline,
    async create(input) {
      const id = `d_${store.size + 1}`;
      const row: DeliveryOrder = { id, ...input };
      store.set(id, row);
      return row;
    },
    async update(id, patch) {
      const cur = store.get(id)!;
      const next = { ...cur, ...patch };
      store.set(id, next);
      return next;
    },
    async get(id) {
      return store.get(id) ?? null;
    },
    async appendTimeline(id, entry) {
      timeline.push({ id, ...entry });
    },
  };
}

const origin = { latitude: -23.55, longitude: -46.63 };
const destination = { latitude: -23.56, longitude: -46.64 };

const driverAvailable: Driver = {
  id: "drv1", user_id: "u1", provider: "LOCALIX", vehicle_type: "moto",
  license_plate: "AAA-0000", phone: null, status: "AVAILABLE", rating: 5,
  current_latitude: -23.551, current_longitude: -46.631,
};

describe("DeliveryStateMachine", () => {
  it("blocks invalid transitions", () => {
    expect(canTransition("WAITING_ASSIGNMENT", "DELIVERED")).toBe(false);
    expect(canTransition("ASSIGNED", "GOING_TO_RESTAURANT")).toBe(true);
    expect(isTerminal("DELIVERED")).toBe(true);
    expect(isTerminal("ASSIGNED")).toBe(false);
  });
});

describe("ETAEngine", () => {
  it("haversine returns positive km", () => {
    expect(haversineKm(origin, destination)).toBeGreaterThan(0);
  });
  it("calculateETA sums components", () => {
    const eta = calculateETA({ distance_km: 5, avg_speed_kmh: 30 });
    expect(eta.total_minutes).toBe(eta.prep_minutes + eta.travel_minutes + eta.wait_minutes + eta.delivery_minutes);
  });
});

describe("AssignmentEngine", () => {
  it("ranks and picks available driver", () => {
    const ranked = rankDrivers([driverAvailable], { origin });
    expect(ranked).toHaveLength(1);
    expect(pickBestDriver([driverAvailable], { origin })?.id).toBe("drv1");
  });
  it("excludes offline drivers", () => {
    const off = { ...driverAvailable, status: "OFFLINE" as const };
    expect(pickBestDriver([off], { origin })).toBeNull();
  });
});

describe("DispatchEngine", () => {
  it("picks LOCALIX when own fleet absent and drivers available", async () => {
    const d = await dispatchEngine.choose({
      strategy: "AUTO",
      context: { restaurant_id: "r", order_id: "o", origin, destination, distance_km: 2 },
      restaurantHasOwnFleet: false,
      drivers: [driverAvailable],
    });
    expect(d.provider).toBe("LOCALIX");
    expect(d.driver?.id).toBe("drv1");
  });
  it("falls back to RESTAURANT for own fleet", async () => {
    const d = await dispatchEngine.choose({
      strategy: "AUTO",
      context: { restaurant_id: "r", order_id: "o", origin, destination, distance_km: 2 },
      restaurantHasOwnFleet: true,
      drivers: [],
    });
    expect(d.provider).toBe("RESTAURANT");
  });
});

describe("DeliveryEngine", () => {
  beforeEach(() => deliveryEventBus.clear());

  it("creates delivery and emits DriverAssigned when driver picked", async () => {
    const repo = makeRepo();
    const engine = new DeliveryEngine(repo);
    const seen: DeliveryEvent[] = [];
    deliveryEventBus.on("DriverAssigned", (e) => { seen.push(e); });

    const order = await engine.createDelivery({
      order_id: "o1", restaurant_id: "r1", strategy: "AUTO",
      context: { restaurant_id: "r1", order_id: "o1", origin, destination, distance_km: 2 },
      restaurantHasOwnFleet: false, drivers: [driverAvailable],
    });

    expect(order.provider).toBe("LOCALIX");
    expect(order.status).toBe("ASSIGNED");
    expect(seen).toHaveLength(1);
  });

  it("transitions through picked_up → on_the_way → delivered", async () => {
    const repo = makeRepo();
    const engine = new DeliveryEngine(repo);
    const order = await engine.createDelivery({
      order_id: "o2", restaurant_id: "r1", strategy: "LOCALIX",
      context: { restaurant_id: "r1", order_id: "o2", origin, destination, distance_km: 2 },
      restaurantHasOwnFleet: false, drivers: [driverAvailable],
    });
    await engine.transition(order.id, "GOING_TO_RESTAURANT");
    await engine.transition(order.id, "WAITING_PICKUP");
    await engine.transition(order.id, "PICKED_UP");
    await engine.transition(order.id, "ON_THE_WAY");
    await engine.transition(order.id, "ARRIVED");
    const final = await engine.transition(order.id, "DELIVERED");
    expect(final.status).toBe("DELIVERED");
    expect(final.finished_at).toBeTruthy();
  });

  it("refuses invalid transition", async () => {
    const repo = makeRepo();
    const engine = new DeliveryEngine(repo);
    const order = await engine.createDelivery({
      order_id: "o3", restaurant_id: "r1", strategy: "RESTAURANT",
      context: { restaurant_id: "r1", order_id: "o3", origin, destination, distance_km: 2 },
      restaurantHasOwnFleet: true,
    });
    await expect(engine.transition(order.id, "DELIVERED")).rejects.toThrow();
  });

  it("cancel emits DeliveryCancelled", async () => {
    const repo = makeRepo();
    const engine = new DeliveryEngine(repo);
    const seen: DeliveryEvent[] = [];
    deliveryEventBus.on("DeliveryCancelled", (e) => { seen.push(e); });
    const order = await engine.createDelivery({
      order_id: "o4", restaurant_id: "r1", strategy: "RESTAURANT",
      context: { restaurant_id: "r1", order_id: "o4", origin, destination, distance_km: 2 },
      restaurantHasOwnFleet: true,
    });
    await engine.cancel(order.id, "customer request");
    expect(seen).toHaveLength(1);
  });

  it("change driver via assignDriver", async () => {
    const repo = makeRepo();
    const engine = new DeliveryEngine(repo);
    const order = await engine.createDelivery({
      order_id: "o5", restaurant_id: "r1", strategy: "LOCALIX",
      context: { restaurant_id: "r1", order_id: "o5", origin, destination, distance_km: 2 },
      restaurantHasOwnFleet: false, drivers: [driverAvailable],
    });
    const updated = await engine.assignDriver(order.id, "drv2");
    expect(updated.driver_id).toBe("drv2");
  });
});

describe("TrackingService", () => {
  it("records history and computes ETA to destination", () => {
    const t = new TrackingService();
    t.updateLocation("drv1", { latitude: -23.551, longitude: -46.631, captured_at: new Date().toISOString() });
    expect(t.getHistory("drv1")).toHaveLength(1);
    expect(t.distanceToDestination("drv1", destination)).toBeGreaterThan(0);
    expect(t.etaMinutes("drv1", destination)).toBeGreaterThan(0);
  });
});
