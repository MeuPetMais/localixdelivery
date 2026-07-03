import type { AIDomainEvent } from "./types";

type Handler = (e: AIDomainEvent) => void | Promise<void>;
const handlers = new Set<Handler>();

export const AIEventBus = {
  subscribe(h: Handler) { handlers.add(h); return () => handlers.delete(h); },
  async publish(e: AIDomainEvent) {
    for (const h of handlers) { try { await h(e); } catch { /* isolated */ } }
  },
  clear() { handlers.clear(); },
} as const;
