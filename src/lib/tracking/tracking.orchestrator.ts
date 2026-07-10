// Tracking Domain — Orchestrator.
// Coordena snapshot + timeline + eventos + auditoria de forma coesa.
// NUNCA muta Orders/Delivery/Driver. Apenas observa.

import type {
  TrackingSnapshot, TrackingSnapshotInput, TrackingSnapshotPatch, TrackingStatus, TrackingActor,
} from "./tracking.types";
import { createTrackingService, trackingService as defaultService, type TrackingService } from "./tracking.service";
import { trackingEventBus, envelopeFromSnapshot } from "./tracking.events";
import { recordTrackingAudit } from "./tracking.audit";

export interface OrchestratorDeps {
  service?: TrackingService;
}

export interface RegisterEventInput {
  assignment_id: string;
  event: string;
  actor?: TrackingActor;
  status?: TrackingStatus;
  metadata?: Record<string, unknown>;
}

export function createTrackingOrchestrator(deps: OrchestratorDeps = {}) {
  const service = deps.service ?? defaultService;

  function publish(type: Parameters<typeof envelopeFromSnapshot>[0], snap: TrackingSnapshot, payload: Record<string, unknown> = {}) {
    trackingEventBus.publish(envelopeFromSnapshot(type, snap, payload));
  }

  return {
    async createSnapshot(input: TrackingSnapshotInput): Promise<TrackingSnapshot> {
      const snap = service.createSnapshot(input);
      service.appendTimeline({
        assignment_id: snap.assignment_id,
        restaurant_id: snap.restaurant_id,
        order_id: snap.order_id,
        driver_id: snap.driver_id,
        event: "snapshot_created",
        current_status: snap.status,
        actor: "system",
        correlation_id: snap.correlation_id,
      });
      publish("TrackingCreated", snap, { status: snap.status });
      publish("TrackingSnapshotUpdated", snap, { status: snap.status });
      await recordTrackingAudit({
        action: "snapshot_created", correlation_id: snap.correlation_id,
        assignment_id: snap.assignment_id, restaurant_id: snap.restaurant_id,
        order_id: snap.order_id, driver_id: snap.driver_id, at: snap.updated_at,
        detail: { status: snap.status },
      });
      return snap;
    },

    async updateSnapshot(assignmentId: string, patch: TrackingSnapshotPatch): Promise<TrackingSnapshot | null> {
      const prev = service.getSnapshot(assignmentId);
      if (!prev) return null;
      const next = service.updateSnapshot(assignmentId, patch);
      if (!next) return null;
      publish("TrackingSnapshotUpdated", next, { patch });
      publish("TrackingUpdated", next, { patch });
      if (patch.status && patch.status !== prev.status) {
        service.appendTimeline({
          assignment_id: next.assignment_id,
          restaurant_id: next.restaurant_id,
          order_id: next.order_id,
          driver_id: next.driver_id,
          event: "status_changed",
          previous_status: prev.status,
          current_status: next.status,
          actor: "system",
          correlation_id: next.correlation_id,
        });
        publish("TrackingStatusChanged", next, { previous: prev.status, current: next.status });
        await recordTrackingAudit({
          action: "status_changed", correlation_id: next.correlation_id,
          assignment_id: next.assignment_id, restaurant_id: next.restaurant_id,
          order_id: next.order_id, driver_id: next.driver_id, at: next.updated_at,
          detail: { previous: prev.status, current: next.status },
        });
      }
      await recordTrackingAudit({
        action: "snapshot_updated", correlation_id: next.correlation_id,
        assignment_id: next.assignment_id, restaurant_id: next.restaurant_id,
        order_id: next.order_id, driver_id: next.driver_id, at: next.updated_at,
        detail: patch as Record<string, unknown>,
      });
      return next;
    },

    async registerEvent(input: RegisterEventInput) {
      const snap = service.getSnapshot(input.assignment_id);
      if (!snap) return null;
      const entry = service.appendTimeline({
        assignment_id: snap.assignment_id,
        restaurant_id: snap.restaurant_id,
        order_id: snap.order_id,
        driver_id: snap.driver_id,
        event: input.event,
        previous_status: snap.status,
        current_status: input.status ?? snap.status,
        actor: input.actor ?? "system",
        metadata: input.metadata,
        correlation_id: snap.correlation_id,
      });
      publish("TrackingTimelineUpdated", snap, { event: input.event });
      await recordTrackingAudit({
        action: "timeline_appended", correlation_id: entry.correlation_id,
        assignment_id: entry.assignment_id, restaurant_id: entry.restaurant_id,
        order_id: entry.order_id, driver_id: entry.driver_id, at: entry.created_at,
        detail: { event: entry.event },
      });
      return entry;
    },
  };
}

export type TrackingOrchestrator = ReturnType<typeof createTrackingOrchestrator>;

export const trackingOrchestrator = createTrackingOrchestrator();
