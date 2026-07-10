// Tracking Domain — Service.
// Fachada única para snapshot + timeline em memória. Pura, sem I/O.
// A persistência remota é feita pelas server functions em tracking.functions.ts.

import type {
  TrackingSnapshot, TrackingSnapshotInput, TrackingSnapshotPatch, TrackingTimelineEntry,
} from "./tracking.types";
import { createInMemorySnapshotStore, type SnapshotStore } from "./tracking.snapshot";
import { createInMemoryTimelineStore, type TimelineStore, type TimelineAppendInput } from "./tracking.timeline";

export interface TrackingServiceDeps {
  snapshots?: SnapshotStore;
  timeline?: TimelineStore;
}

export function createTrackingService(deps: TrackingServiceDeps = {}) {
  const snapshots = deps.snapshots ?? createInMemorySnapshotStore();
  const timeline = deps.timeline ?? createInMemoryTimelineStore();

  return {
    createSnapshot(input: TrackingSnapshotInput): TrackingSnapshot {
      return snapshots.upsert(input);
    },
    updateSnapshot(assignmentId: string, patch: TrackingSnapshotPatch): TrackingSnapshot | null {
      return snapshots.patch(assignmentId, patch);
    },
    getSnapshot(assignmentId: string): TrackingSnapshot | null {
      return snapshots.get(assignmentId);
    },
    appendTimeline(input: TimelineAppendInput): TrackingTimelineEntry {
      return timeline.append(input);
    },
    currentTracking(assignmentId: string): {
      snapshot: TrackingSnapshot | null;
      timeline: TrackingTimelineEntry[];
    } {
      return {
        snapshot: snapshots.get(assignmentId),
        timeline: timeline.list(assignmentId),
      };
    },
    _reset() { snapshots.clear(); timeline.clear(); },
  };
}

export type TrackingService = ReturnType<typeof createTrackingService>;

export const trackingService = createTrackingService();
