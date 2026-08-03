import { DRIVER_LOCATION_POLICIES } from "./driver-location.types";
import type { DriverLocationMode, DriverLocationSample } from "./driver-location.types";

type GeoPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
};

type GeoError = { code?: number; message?: string };

export interface GeolocationLike {
  watchPosition(
    success: (position: GeoPosition) => void,
    error?: (error: GeoError) => void,
    options?: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

export interface DriverLocationTrackerContext {
  driverId: string;
  restaurantId: string;
  assignmentId?: string | null;
  online: boolean;
  paused?: boolean;
  delivering?: boolean;
}

export interface DriverLocationTrackerDeps {
  geolocation?: GeolocationLike | null;
  upload: (sample: DriverLocationSample) => Promise<void>;
  now?: () => number;
  onPermissionDenied?: () => void;
  onUnsupported?: () => void;
}

const EARTH_R = 6_371_000;

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function resolveLocationMode(ctx: DriverLocationTrackerContext): DriverLocationMode {
  if (!ctx.online) return "offline";
  if (ctx.paused) return "paused";
  if (ctx.delivering || ctx.assignmentId) return "delivery";
  return "available";
}

export class DriverLocationTracker {
  private watchId: number | null = null;
  private context: DriverLocationTrackerContext | null = null;
  private lastSent: { lat: number; lng: number; at: number } | null = null;
  private watchMode: DriverLocationMode | null = null;

  constructor(private readonly deps: DriverLocationTrackerDeps) {}

  update(ctx: DriverLocationTrackerContext | null) {
    this.context = ctx;
    const mode = ctx ? resolveLocationMode(ctx) : "offline";
    if (!ctx || mode === "offline" || mode === "paused") {
      this.stop();
      return;
    }
    if (this.watchId != null && this.watchMode !== mode) {
      this.stop();
    }
    this.start();
  }

  start() {
    const ctx = this.context;
    if (!ctx || this.watchId != null) return;
    const geolocation = this.deps.geolocation;
    if (!geolocation) {
      this.deps.onUnsupported?.();
      return;
    }
    const mode = resolveLocationMode(ctx);
    const policy = DRIVER_LOCATION_POLICIES[mode];
    this.watchId = geolocation.watchPosition(
      (position) => void this.handlePosition(position),
      (error) => {
        if (error.code === 1) this.deps.onPermissionDenied?.();
      },
      {
        enableHighAccuracy: policy.enableHighAccuracy,
        maximumAge: policy.minIntervalMs,
        timeout: policy.mode === "delivery" ? 10_000 : 20_000,
      },
    );
    this.watchMode = mode;
  }

  stop() {
    if (this.watchId == null) return;
    this.deps.geolocation?.clearWatch(this.watchId);
    this.watchId = null;
    this.watchMode = null;
  }

  async handlePosition(position: GeoPosition) {
    const ctx = this.context;
    if (!ctx || !ctx.online || ctx.paused) return;
    const policy = DRIVER_LOCATION_POLICIES[resolveLocationMode(ctx)];
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const now = this.deps.now?.() ?? Date.now();
    if (now - position.timestamp > 120_000 || position.timestamp - now > 60_000) return;

    if (this.lastSent) {
      const elapsed = now - this.lastSent.at;
      const distance = metersBetween(this.lastSent, { lat, lng });
      if (elapsed < policy.minIntervalMs && distance < policy.minDistanceMeters) return;
    }

    this.lastSent = { lat, lng, at: now };
    await this.deps.upload({
      driver_id: ctx.driverId,
      restaurant_id: ctx.restaurantId,
      assignment_id: ctx.assignmentId ?? null,
      lat,
      lng,
      accuracy: position.coords.accuracy ?? null,
      heading: position.coords.heading ?? null,
      speed: position.coords.speed ?? null,
      captured_at: new Date(position.timestamp || now).toISOString(),
      source: "gps",
    });
  }
}
