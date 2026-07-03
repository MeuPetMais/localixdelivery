import type { AnalyticsEvent } from "./types";

type Handler = (event: AnalyticsEvent) => void | Promise<void>;
const handlers = new Set<Handler>();

export const AnalyticsEventBus = {
  subscribe(handler: Handler) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
  async publish(event: AnalyticsEvent) {
    for (const h of handlers) {
      try { await h(event); } catch { /* isolate */ }
    }
    return event;
  },
  _reset() { handlers.clear(); },
};
