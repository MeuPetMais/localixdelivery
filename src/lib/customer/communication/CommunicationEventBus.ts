import type { CommunicationEvent } from "./types";

type Handler = (e: CommunicationEvent) => void | Promise<void>;
const handlers = new Set<Handler>();

export const CommunicationEventBus = {
  subscribe(h: Handler) { handlers.add(h); return () => handlers.delete(h); },
  async publish(event: CommunicationEvent) {
    for (const h of handlers) {
      try { await h(event); } catch (err) { console.error("[CommunicationEventBus] handler error", err); }
    }
  },
  _handlerCount() { return handlers.size; },
} as const;
