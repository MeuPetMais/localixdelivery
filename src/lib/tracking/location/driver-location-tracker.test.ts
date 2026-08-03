import { describe, expect, it, vi } from "vitest";
import { DriverLocationTracker, type GeolocationLike } from "./driver-location-tracker";
import {
  canReadCustomerDeliveryLocation,
  canReadDriverOperationalLocation,
} from "./driver-location-access";

function makeGeo() {
  let success: ((position: any) => void) | null = null;
  let error: ((error: any) => void) | undefined;
  const clearWatch = vi.fn();
  const geo: GeolocationLike = {
    watchPosition: vi.fn((ok, fail) => {
      success = ok;
      error = fail;
      return 7;
    }),
    clearWatch,
  };
  return {
    geo,
    clearWatch,
    emit(lat = -23.55, lng = -46.63, timestamp = 1_000, accuracy = 20) {
      success?.({
        coords: { latitude: lat, longitude: lng, accuracy, heading: 90, speed: 5 },
        timestamp,
      });
    },
    deny() {
      error?.({ code: 1, message: "denied" });
    },
  };
}

const base = {
  driverId: "driver_1",
  restaurantId: "rest_1",
  online: true,
};

describe("DriverLocationTracker", () => {
  it("permissao concedida inicia watchPosition e envia amostra", async () => {
    const geo = makeGeo();
    const upload = vi.fn().mockResolvedValue(undefined);
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload, now: () => 1_000 });

    tracker.update(base);
    geo.emit();
    await Promise.resolve();

    expect(geo.geo.watchPosition).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ driver_id: "driver_1" }));
  });

  it("permissao negada informa callback e nao quebra", () => {
    const geo = makeGeo();
    const denied = vi.fn();
    const tracker = new DriverLocationTracker({
      geolocation: geo.geo,
      upload: vi.fn(),
      onPermissionDenied: denied,
    });

    tracker.update(base);
    geo.deny();

    expect(denied).toHaveBeenCalledOnce();
  });

  it("motoboy offline nao envia", () => {
    const geo = makeGeo();
    const upload = vi.fn();
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload });

    tracker.update({ ...base, online: false });

    expect(geo.geo.watchPosition).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("online disponivel limita updates em frequencia moderada", async () => {
    const geo = makeGeo();
    const upload = vi.fn().mockResolvedValue(undefined);
    let now = 1_000;
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload, now: () => now });

    tracker.update(base);
    geo.emit(-23.55, -46.63, now);
    now += 30_000;
    geo.emit(-23.5501, -46.6301, now);
    await Promise.resolve();

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("em entrega usa frequencia maior", async () => {
    const geo = makeGeo();
    const upload = vi.fn().mockResolvedValue(undefined);
    let now = 1_000;
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload, now: () => now });

    tracker.update({ ...base, assignmentId: "assign_1", delivering: true });
    geo.emit(-23.55, -46.63, now);
    now += 16_000;
    geo.emit(-23.5503, -46.6303, now);
    await Promise.resolve();

    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("pausa suspende atualizacoes", () => {
    const geo = makeGeo();
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload: vi.fn() });

    tracker.update({ ...base, paused: true });

    expect(geo.geo.watchPosition).not.toHaveBeenCalled();
  });

  it("logout encerra rastreamento", () => {
    const geo = makeGeo();
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload: vi.fn() });

    tracker.update(base);
    tracker.update(null);

    expect(geo.clearWatch).toHaveBeenCalledWith(7);
  });

  it("coordenada duplicada e limitada", async () => {
    const geo = makeGeo();
    const upload = vi.fn().mockResolvedValue(undefined);
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload, now: () => 1_000 });

    tracker.update(base);
    geo.emit();
    geo.emit();
    await Promise.resolve();

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("coordenada antiga e ignorada", async () => {
    const geo = makeGeo();
    const upload = vi.fn().mockResolvedValue(undefined);
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload, now: () => 200_000 });

    tracker.update(base);
    geo.emit(-23.55, -46.63, 1_000);
    await Promise.resolve();

    expect(upload).not.toHaveBeenCalled();
  });

  it("subscription/watch e removido ao desmontar", () => {
    const geo = makeGeo();
    const tracker = new DriverLocationTracker({ geolocation: geo.geo, upload: vi.fn() });

    tracker.update(base);
    tracker.stop();

    expect(geo.clearWatch).toHaveBeenCalledWith(7);
  });
});

describe("Driver location access rules", () => {
  const subject = {
    driverOwnerId: "driver_user",
    restaurantId: "rest_1",
    orderId: "order_1",
    trackingStatus: "EM_ROTA",
  };

  it("restaurante ve somente seus motoboys", () => {
    expect(canReadDriverOperationalLocation(
      { type: "restaurant", userId: "owner", restaurantIds: ["rest_1"] },
      subject,
    )).toBe(true);
    expect(canReadDriverOperationalLocation(
      { type: "restaurant", userId: "other", restaurantIds: ["rest_2"] },
      subject,
    )).toBe(false);
  });

  it("cliente ve somente motoboy do proprio pedido ativo", () => {
    expect(canReadCustomerDeliveryLocation(
      { type: "customer", userId: "customer", orderIds: ["order_1"] },
      subject,
    )).toBe(true);
    expect(canReadCustomerDeliveryLocation(
      { type: "customer", userId: "customer", orderIds: ["other"] },
      subject,
    )).toBe(false);
    expect(canReadCustomerDeliveryLocation(
      { type: "customer", userId: "customer", orderIds: ["order_1"] },
      { ...subject, trackingStatus: "ENTREGUE" },
    )).toBe(false);
  });
});
