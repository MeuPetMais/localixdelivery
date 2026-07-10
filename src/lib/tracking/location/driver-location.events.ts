// Driver Location — Event bus in-process.
// Publica somente eventos observacionais.

import type { DriverLocationEvaluation, DriverLocationSample } from "./driver-location.types";

export type DriverLocationEventType =
  | "DriverLocationReceived"
  | "DriverLocationAccepted"
  | "DriverLocationRejected"
  | "DriverLocationSynced";

export interface DriverLocationEvent {
  type: DriverLocationEventType;
  driver_id: string;
  assignment_id: string | null;
  restaurant_id: string | null;
  at: string;
  correlation_id: string;
  sample: DriverLocationSample;
  evaluation?: DriverLocationEvaluation;
  reason?: string;
}

type Listener = (evt: DriverLocationEvent) => void;

class DriverLocationBus {
  private listeners = new Set<Listener>();
  subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  publish(evt: DriverLocationEvent) {
    for (const l of Array.from(this.listeners)) {
      try { l(evt); } catch (err) { console.error("[driver-location-bus]", err); }
    }
  }
  clear() { this.listeners.clear(); }
}

export const driverLocationBus = new DriverLocationBus();
