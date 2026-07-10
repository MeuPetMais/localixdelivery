// Tracking Domain — Snapshot store (in-memory / testes).
// Persistência real vive nas server functions (Supabase). Este store existe
// para orquestração local, testes e uso client-side controlado.

import type { TrackingSnapshot, TrackingSnapshotInput, TrackingSnapshotPatch } from "./tracking.types";

export interface SnapshotStore {
  upsert(input: TrackingSnapshotInput): TrackingSnapshot;
  patch(assignmentId: string, patch: TrackingSnapshotPatch): TrackingSnapshot | null;
  get(assignmentId: string): TrackingSnapshot | null;
  clear(): void;
}

export function createInMemorySnapshotStore(): SnapshotStore {
  const store = new Map<string, TrackingSnapshot>();

  const now = () => new Date().toISOString();

  return {
    upsert(input) {
      const existing = store.get(input.assignment_id);
      const merged: TrackingSnapshot = {
        id: existing?.id ?? cryptoRandom(),
        assignment_id: input.assignment_id,
        driver_id: input.driver_id,
        restaurant_id: input.restaurant_id,
        order_id: input.order_id,
        status: input.status,
        eta_seconds: input.eta_seconds ?? existing?.eta_seconds ?? null,
        confidence: input.confidence ?? existing?.confidence ?? "MEDIUM",
        last_lat: existing?.last_lat ?? null,
        last_lng: existing?.last_lng ?? null,
        last_speed: existing?.last_speed ?? null,
        last_heading: existing?.last_heading ?? null,
        last_seen_at: existing?.last_seen_at ?? null,
        metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
        correlation_id: input.correlation_id ?? existing?.correlation_id ?? cryptoRandom(),
        created_at: existing?.created_at ?? now(),
        updated_at: now(),
      };
      store.set(input.assignment_id, merged);
      return merged;
    },
    patch(assignmentId, patch) {
      const cur = store.get(assignmentId);
      if (!cur) return null;
      const next: TrackingSnapshot = {
        ...cur,
        ...patch,
        metadata: { ...cur.metadata, ...(patch.metadata ?? {}) },
        updated_at: now(),
      };
      store.set(assignmentId, next);
      return next;
    },
    get(id) { return store.get(id) ?? null; },
    clear() { store.clear(); },
  };
}

function cryptoRandom(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
