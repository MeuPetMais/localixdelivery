import type { GeoPoint } from "./types";

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface ETABreakdown {
  prep_minutes: number;
  travel_minutes: number;
  wait_minutes: number;
  delivery_minutes: number;
  total_minutes: number;
}

export function calculateETA(params: {
  prep_minutes?: number;
  distance_km: number;
  avg_speed_kmh?: number;
  wait_minutes?: number;
  delivery_minutes?: number;
}): ETABreakdown {
  const prep = params.prep_minutes ?? 15;
  const speed = params.avg_speed_kmh ?? 25;
  const travel = Math.max(1, Math.round((params.distance_km / speed) * 60));
  const wait = params.wait_minutes ?? 3;
  const delivery = params.delivery_minutes ?? 3;
  return {
    prep_minutes: prep,
    travel_minutes: travel,
    wait_minutes: wait,
    delivery_minutes: delivery,
    total_minutes: prep + travel + wait + delivery,
  };
}
