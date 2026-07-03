import type { ProductLifecycleStatus } from "./types";

export type ProductDomainEvent =
  | { type: "ProductCreated"; productId: string; restaurantId: string; at: string }
  | { type: "ProductUpdated"; productId: string; restaurantId: string; changes: Record<string, unknown>; at: string }
  | { type: "ProductPublished"; productId: string; restaurantId: string; at: string }
  | { type: "ProductArchived"; productId: string; restaurantId: string; at: string }
  | { type: "ProductDiscontinued"; productId: string; restaurantId: string; at: string }
  | { type: "AvailabilityChanged"; productId: string; restaurantId: string; available: boolean; at: string }
  | { type: "LifecycleChanged"; productId: string; restaurantId: string; from: ProductLifecycleStatus; to: ProductLifecycleStatus; at: string };

export type ProductEventListener = (event: ProductDomainEvent) => void | Promise<void>;

/**
 * ProductEventBus — in-memory publish/subscribe. Mirrors the pattern used by
 * CostEventBus / PurchaseEventBus / ReportEventBus.
 */
class Bus {
  private readonly listeners = new Set<ProductEventListener>();

  subscribe(listener: ProductEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async publish(event: ProductDomainEvent): Promise<void> {
    await Promise.all(Array.from(this.listeners).map((l) => {
      try {
        return Promise.resolve(l(event));
      } catch (err) {
        console.error("[ProductEventBus] listener failed", err);
        return Promise.resolve();
      }
    }));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const ProductEventBus = new Bus();
