import type { PlatformConfigEvent } from "./types";

type Handler = (event: PlatformConfigEvent) => void | Promise<void>;

class Bus {
  private handlers = new Set<Handler>();
  subscribe(h: Handler): () => void { this.handlers.add(h); return () => this.handlers.delete(h); }
  async publish(event: PlatformConfigEvent): Promise<void> {
    for (const h of this.handlers) {
      try { await h(event); } catch (e) { console.error("[PlatformConfigEventBus]", e); }
    }
  }
  clear(): void { this.handlers.clear(); }
}

export const PlatformConfigEventBus = new Bus();
