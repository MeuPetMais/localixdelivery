// Tracking Domain — Mapper: row ⇄ domain / domain ⇄ payload público.

import type { TrackingSnapshot, TrackingTimelineEntry } from "./tracking.types";
import type { TrackingRealtimePayload } from "./tracking.contracts";

type Row = Record<string, unknown>;

export function toSnapshot(row: Row): TrackingSnapshot {
  return {
    id: String(row.id),
    assignment_id: String(row.assignment_id),
    driver_id: String(row.driver_id),
    restaurant_id: String(row.restaurant_id),
    order_id: String(row.order_id),
    status: row.status as TrackingSnapshot["status"],
    eta_seconds: row.eta_seconds == null ? null : Number(row.eta_seconds),
    confidence: (row.confidence ?? "MEDIUM") as TrackingSnapshot["confidence"],
    last_lat: row.last_lat == null ? null : Number(row.last_lat),
    last_lng: row.last_lng == null ? null : Number(row.last_lng),
    last_speed: row.last_speed == null ? null : Number(row.last_speed),
    last_heading: row.last_heading == null ? null : Number(row.last_heading),
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    correlation_id: String(row.correlation_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function toTimelineEntry(row: Row): TrackingTimelineEntry {
  return {
    id: String(row.id),
    assignment_id: String(row.assignment_id),
    restaurant_id: String(row.restaurant_id),
    order_id: String(row.order_id),
    driver_id: (row.driver_id as string | null) ?? null,
    event: String(row.event),
    previous_status: (row.previous_status as TrackingTimelineEntry["previous_status"]) ?? null,
    current_status: (row.current_status as TrackingTimelineEntry["current_status"]) ?? null,
    actor: (row.actor ?? "system") as TrackingTimelineEntry["actor"],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    correlation_id: String(row.correlation_id),
    created_at: String(row.created_at),
  };
}

export function toPublicPayload(snap: TrackingSnapshot): TrackingRealtimePayload {
  return {
    assignment_id: snap.assignment_id,
    order_id: snap.order_id,
    status: snap.status,
    eta_seconds: snap.eta_seconds,
    confidence: snap.confidence,
    updated_at: snap.updated_at,
  };
}
