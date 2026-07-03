import type { GeoPoint } from "./types";
import { haversineKm, calculateETA } from "./ETAEngine";

export interface TrackPoint extends GeoPoint {
  captured_at: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

export class TrackingService {
  private history = new Map<string, TrackPoint[]>();

  updateLocation(driverId: string, point: TrackPoint) {
    const arr = this.history.get(driverId) ?? [];
    arr.push(point);
    // cap history to last 500 points in memory
    if (arr.length > 500) arr.shift();
    this.history.set(driverId, arr);
  }

  getHistory(driverId: string): TrackPoint[] {
    return this.history.get(driverId) ?? [];
  }

  distanceToDestination(driverId: string, destination: GeoPoint): number | null {
    const h = this.history.get(driverId);
    const last = h?.[h.length - 1];
    if (!last) return null;
    return haversineKm(last, destination);
  }

  etaMinutes(driverId: string, destination: GeoPoint, avgSpeedKmh = 25): number | null {
    const dist = this.distanceToDestination(driverId, destination);
    if (dist == null) return null;
    return calculateETA({ distance_km: dist, avg_speed_kmh: avgSpeedKmh, prep_minutes: 0, wait_minutes: 0, delivery_minutes: 2 }).total_minutes;
  }

  clear(driverId?: string) {
    if (driverId) this.history.delete(driverId);
    else this.history.clear();
  }
}

export const trackingService = new TrackingService();
