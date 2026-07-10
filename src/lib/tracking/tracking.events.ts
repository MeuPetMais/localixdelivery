// Tracking Domain — Event bus (in-process).
// Publica eventos observacionais. Nunca dispara mutação em outros domínios.

import type { TrackingSnapshot, TrackingTimelineEntry, TrackingStatus } from "./tracking.types";

export type TrackingEventType =
  | "TrackingCreated"
  | "TrackingUpdated"
  | "TrackingSnapshotUpdated"
  | "TrackingTimelineUpdated"
  | "TrackingStatusChanged";

export interface TrackingEventEnvelope<T = unknown> {
  type: TrackingEventType;
  correlation_id: string;
  assignment_id: string;
  restaurant_id: string;
  order_id: string;
  driver_id: string | null;
  at: string;
  payload: T;
}

export interface TrackingStatusChangedPayload {
  previous: TrackingStatus | null;
  current: TrackingStatus;
}

type Listener = (evt: TrackingEventEnvelope) => void;

class TrackingEventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(evt: TrackingEventEnvelope) {
    for (const l of Array.from(this.listeners)) {
      try { l(evt); } catch (err) { console.error("[tracking-bus]", err); }
    }
  }

  clear() { this.listeners.clear(); }
}

export const trackingEventBus = new TrackingEventBus();

export function envelopeFromSnapshot<T>(
  type: TrackingEventType,
  snap: Pick<TrackingSnapshot, "assignment_id" | "restaurant_id" | "order_id" | "driver_id" | "correlation_id">,
  payload: T,
): TrackingEventEnvelope<T> {
  return {
    type,
    correlation_id: snap.correlation_id,
    assignment_id: snap.assignment_id,
    restaurant_id: snap.restaurant_id,
    order_id: snap.order_id,
    driver_id: snap.driver_id ?? null,
    at: new Date().toISOString(),
    payload,
  };
}

export function envelopeFromTimeline<T>(
  type: TrackingEventType,
  entry: Pick<TrackingTimelineEntry, "assignment_id" | "restaurant_id" | "order_id" | "driver_id" | "correlation_id">,
  payload: T,
): TrackingEventEnvelope<T> {
  return {
    type,
    correlation_id: entry.correlation_id,
    assignment_id: entry.assignment_id,
    restaurant_id: entry.restaurant_id,
    order_id: entry.order_id,
    driver_id: entry.driver_id,
    at: new Date().toISOString(),
    payload,
  };
}
