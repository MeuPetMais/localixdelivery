// ETA Calculator — cálculo puro por estratégia.

import type { EtaInput, EtaAlgorithm, EtaEngineConfig } from "./eta.types";
import { DEFAULT_ETA_CONFIG } from "./eta.types";

const R = 6371_000; // metros
export function haversineMeters(
  aLat: number, aLng: number, bLat: number, bLng: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface EtaStrategy {
  readonly id: EtaAlgorithm;
  estimate(input: EtaInput, config: EtaEngineConfig): {
    eta_seconds: number;
    distance_km: number;
    reasons: string[];
  };
}

export const DistanceStrategy: EtaStrategy = {
  id: "distance",
  estimate(input, config) {
    const reasons: string[] = [];
    if (input.driver_lat == null || input.driver_lng == null) {
      reasons.push("driver_position_missing");
      return { eta_seconds: 0, distance_km: 0, reasons };
    }
    const meters = haversineMeters(
      input.driver_lat, input.driver_lng,
      input.destination_lat, input.destination_lng,
    );
    let speed = input.speed_ms ?? config.default_speed_ms;
    if (!Number.isFinite(speed) || speed < config.min_speed_ms) {
      reasons.push("speed_floor_applied");
      speed = Math.max(config.min_speed_ms, config.default_speed_ms);
    }
    const eta = Math.max(1, Math.round(meters / speed));
    reasons.push(`distance_${Math.round(meters)}m`, `speed_${speed.toFixed(1)}ms`);
    return { eta_seconds: eta, distance_km: meters / 1000, reasons };
  },
};

export const DEFAULT_STRATEGY = DistanceStrategy;
export { DEFAULT_ETA_CONFIG };
