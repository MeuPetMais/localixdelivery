// Tracking Domain — Timeline store (append-only, in-memory / testes).
// Nunca armazenar posição GPS continuamente aqui. Somente eventos relevantes.

import type { TrackingTimelineEntry, TrackingStatus, TrackingActor } from "./tracking.types";

export interface TimelineAppendInput {
  assignment_id: string;
  restaurant_id: string;
  order_id: string;
  driver_id: string | null;
  event: string;
  previous_status?: TrackingStatus | null;
  current_status?: TrackingStatus | null;
  actor?: TrackingActor;
  metadata?: Record<string, unknown>;
  correlation_id: string;
}

export interface TimelineStore {
  append(input: TimelineAppendInput): TrackingTimelineEntry;
  list(assignmentId: string): TrackingTimelineEntry[];
  clear(): void;
}

export function createInMemoryTimelineStore(): TimelineStore {
  const entries: TrackingTimelineEntry[] = [];

  return {
    append(input) {
      const entry: TrackingTimelineEntry = {
        id: cryptoRandom(),
        assignment_id: input.assignment_id,
        restaurant_id: input.restaurant_id,
        order_id: input.order_id,
        driver_id: input.driver_id,
        event: input.event,
        previous_status: input.previous_status ?? null,
        current_status: input.current_status ?? null,
        actor: input.actor ?? "system",
        metadata: input.metadata ?? {},
        correlation_id: input.correlation_id,
        created_at: new Date().toISOString(),
      };
      entries.push(entry);
      return entry;
    },
    list(assignmentId) {
      return entries.filter((e) => e.assignment_id === assignmentId);
    },
    clear() { entries.length = 0; },
  };
}

function cryptoRandom(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
