import type { Driver, GeoPoint } from "./types";
import { haversineKm } from "./ETAEngine";

export interface AssignmentContext {
  origin: GeoPoint;
  max_distance_km?: number;
  min_rating?: number;
  service_area?: (d: Driver) => boolean;
  current_load?: Map<string, number>;
  max_load?: number;
}

export interface RankedDriver {
  driver: Driver;
  distance_km: number;
  score: number;
}

export function rankDrivers(drivers: Driver[], ctx: AssignmentContext): RankedDriver[] {
  const maxDist = ctx.max_distance_km ?? 10;
  const minRating = ctx.min_rating ?? 0;
  const maxLoad = ctx.max_load ?? 3;
  const ranked: RankedDriver[] = [];

  for (const d of drivers) {
    if (d.status !== "AVAILABLE") continue;
    if (d.rating < minRating) continue;
    if (ctx.service_area && !ctx.service_area(d)) continue;
    if (d.current_latitude == null || d.current_longitude == null) continue;
    const load = ctx.current_load?.get(d.id) ?? 0;
    if (load >= maxLoad) continue;
    const dist = haversineKm(ctx.origin, {
      latitude: d.current_latitude,
      longitude: d.current_longitude,
    });
    if (dist > maxDist) continue;
    // score: menor distância + maior rating + menor carga
    const score = -dist + d.rating * 2 - load * 1.5;
    ranked.push({ driver: d, distance_km: dist, score });
  }
  return ranked.sort((a, b) => b.score - a.score);
}

export function pickBestDriver(drivers: Driver[], ctx: AssignmentContext): Driver | null {
  const r = rankDrivers(drivers, ctx);
  return r[0]?.driver ?? null;
}
