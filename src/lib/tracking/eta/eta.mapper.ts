// ETA Mapper — DTOs por audiência.

import type { EtaResult } from "./eta.types";

export interface CustomerEtaView {
  eta_minutes: number;
  window_min_minutes: number;
  window_max_minutes: number;
  message: string;
  updated_at: string;
}

export interface RestaurantEtaView {
  eta_seconds: number;
  eta_minutes: number;
  window_min_seconds: number;
  window_max_seconds: number;
  confidence: EtaResult["confidence"];
  updated_at: string;
}

export interface OperationsEtaView extends RestaurantEtaView {
  algorithm: string;
  distance_km: number;
  reasons: string[];
}

function friendlyMessage(result: EtaResult): string {
  const minMin = Math.max(1, Math.round(result.window.min_seconds / 60));
  const maxMin = Math.max(minMin + 1, Math.round(result.window.max_seconds / 60));
  if (result.confidence === "LOW") return `Chegada estimada entre ${minMin}–${maxMin} min (estimativa aproximada).`;
  return `Chegada estimada entre ${minMin}–${maxMin} min.`;
}

export function toCustomerView(result: EtaResult): CustomerEtaView {
  return {
    eta_minutes: Math.max(1, Math.round(result.eta_seconds / 60)),
    window_min_minutes: Math.max(1, Math.round(result.window.min_seconds / 60)),
    window_max_minutes: Math.max(1, Math.round(result.window.max_seconds / 60)),
    message: friendlyMessage(result),
    updated_at: result.updated_at,
  };
}

export function toRestaurantView(result: EtaResult): RestaurantEtaView {
  return {
    eta_seconds: result.eta_seconds,
    eta_minutes: Math.max(1, Math.round(result.eta_seconds / 60)),
    window_min_seconds: result.window.min_seconds,
    window_max_seconds: result.window.max_seconds,
    confidence: result.confidence,
    updated_at: result.updated_at,
  };
}

export function toOperationsView(result: EtaResult): OperationsEtaView {
  return {
    ...toRestaurantView(result),
    algorithm: result.algorithm,
    distance_km: result.distance_km,
    reasons: result.reasons,
  };
}
