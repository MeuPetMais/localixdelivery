import type { PlatformDomainEvent } from "./types";

type Handler = (event: PlatformDomainEvent) => void | Promise<void>;

class Bus {
  private handlers = new Set<Handler>();

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async publish(event: PlatformDomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (err) {
        // Não propagar falhas de subscribers (auditoria/notify) para o publisher.
        // eslint-disable-next-line no-console
        console.error("[PlatformEventBus] subscriber error", err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const PlatformEventBus = new Bus();
