// Driver Presence Service — puro, sem I/O.
// Gerencia estado operacional + intervalo de heartbeat adaptativo.

import {
  DEFAULT_HEARTBEAT_INTERVALS,
  type DriverPresence,
  type DriverPresenceState,
  type HeartbeatIntervals,
} from "./driver-presence.types";
import { driverPresenceBus } from "./driver-presence.events";

export interface PresenceServiceDeps {
  intervals?: Partial<HeartbeatIntervals>;
  now?: () => Date;
}

export interface SetPresenceInput {
  driver_id: string;
  restaurant_id?: string | null;
  state: DriverPresenceState;
  approaching_destination?: boolean; // ativa PROXIMO_DESTINO no EM_ENTREGA
}

export function createDriverPresenceService(deps: PresenceServiceDeps = {}) {
  const intervals = { ...DEFAULT_HEARTBEAT_INTERVALS, ...(deps.intervals ?? {}) };
  const now = deps.now ?? (() => new Date());
  const store = new Map<string, DriverPresence>();

  function resolveInterval(state: DriverPresenceState, approaching?: boolean): number {
    if (state === "EM_ENTREGA" && approaching) return intervals.PROXIMO_DESTINO;
    return intervals[state] ?? intervals.ONLINE;
  }

  return {
    setPresence(input: SetPresenceInput): DriverPresence {
      const prev = store.get(input.driver_id);
      const next: DriverPresence = {
        driver_id: input.driver_id,
        restaurant_id: input.restaurant_id ?? prev?.restaurant_id ?? null,
        state: input.state,
        updated_at: now().toISOString(),
        heartbeat_interval_ms: resolveInterval(input.state, input.approaching_destination),
      };
      store.set(input.driver_id, next);
      if (!prev || prev.state !== next.state || prev.heartbeat_interval_ms !== next.heartbeat_interval_ms) {
        driverPresenceBus.publish({
          type: "DriverPresenceChanged",
          driver_id: next.driver_id,
          restaurant_id: next.restaurant_id,
          previous: prev?.state,
          current: next.state,
          presence: next,
          at: next.updated_at,
        });
      }
      return next;
    },
    heartbeat(driverId: string): DriverPresence | null {
      const cur = store.get(driverId);
      if (!cur) return null;
      const next: DriverPresence = { ...cur, updated_at: now().toISOString() };
      store.set(driverId, next);
      driverPresenceBus.publish({
        type: "DriverPresenceHeartbeat",
        driver_id: driverId,
        restaurant_id: next.restaurant_id,
        current: next.state,
        presence: next,
        at: next.updated_at,
      });
      return next;
    },
    get(driverId: string): DriverPresence | null { return store.get(driverId) ?? null; },
    intervalFor(state: DriverPresenceState, approaching?: boolean) { return resolveInterval(state, approaching); },
    _reset() { store.clear(); },
  };
}

export type DriverPresenceService = ReturnType<typeof createDriverPresenceService>;
export const driverPresenceService = createDriverPresenceService();
