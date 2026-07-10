// Driver Presence — Event bus in-process.
import type { DriverPresence, DriverPresenceState } from "./driver-presence.types";

export type DriverPresenceEventType =
  | "DriverPresenceChanged"
  | "DriverPresenceHeartbeat";

export interface DriverPresenceEvent {
  type: DriverPresenceEventType;
  driver_id: string;
  restaurant_id: string | null;
  previous?: DriverPresenceState;
  current: DriverPresenceState;
  presence: DriverPresence;
  at: string;
}

type Listener = (evt: DriverPresenceEvent) => void;

class DriverPresenceBus {
  private listeners = new Set<Listener>();
  subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  publish(evt: DriverPresenceEvent) {
    for (const l of Array.from(this.listeners)) {
      try { l(evt); } catch (err) { console.error("[driver-presence-bus]", err); }
    }
  }
  clear() { this.listeners.clear(); }
}

export const driverPresenceBus = new DriverPresenceBus();
