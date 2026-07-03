import type {
  CustomerInsightRecord,
  CustomerScore,
  CustomerSegment,
} from "./types";

export type IntelligenceDomainEvent =
  | { type: "CustomerSegmentUpdated"; customerId: string; restaurantId: string; segment: CustomerSegment; at: string }
  | { type: "CustomerInsightGenerated"; insight: CustomerInsightRecord; at: string }
  | { type: "CustomerScoreUpdated"; score: CustomerScore; at: string }
  | { type: "CustomerHealthChanged"; customerId: string; restaurantId: string; previous: number; current: number; at: string };

type Handler = (e: IntelligenceDomainEvent) => void | Promise<void>;

const handlers = new Set<Handler>();

export const IntelligenceEventBus = {
  subscribe(h: Handler): () => void {
    handlers.add(h);
    return () => handlers.delete(h);
  },
  async publish(e: IntelligenceDomainEvent): Promise<void> {
    for (const h of handlers) {
      try { await h(e); } catch { /* isolated */ }
    }
  },
  clear(): void { handlers.clear(); },
} as const;
