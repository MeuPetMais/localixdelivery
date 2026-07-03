import type { MarketingDomainEvent } from "./types";

type Handler = (e: MarketingDomainEvent) => void | Promise<void>;
const handlers = new Set<Handler>();

export const MarketingEventBus = {
  subscribe(h: Handler): () => void {
    handlers.add(h);
    return () => handlers.delete(h);
  },
  async publish(e: MarketingDomainEvent): Promise<void> {
    for (const h of handlers) {
      try { await h(e); } catch { /* isolated */ }
    }
  },
  clear(): void { handlers.clear(); },
} as const;
