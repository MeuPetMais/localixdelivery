import type { CatalogMenuStatus } from "./types";

export type CatalogDomainEvent =
  | { type: "CatalogCreated"; restaurantId: string; at: string }
  | { type: "CatalogUpdated"; restaurantId: string; menuId: string; changes: Record<string, unknown>; at: string }
  | { type: "MenuCreated"; menuId: string; restaurantId: string; at: string }
  | { type: "MenuPublished"; menuId: string; restaurantId: string; at: string }
  | { type: "MenuArchived"; menuId: string; restaurantId: string; at: string }
  | { type: "MenuStatusChanged"; menuId: string; restaurantId: string; from: CatalogMenuStatus; to: CatalogMenuStatus; at: string }
  | { type: "CategoryCreated"; menuId: string; categoryId: string; restaurantId: string; at: string }
  | { type: "CategoryRemoved"; menuId: string; categoryId: string; restaurantId: string; at: string }
  | { type: "ProductAttached"; menuId: string; productId: string; restaurantId: string; at: string }
  | { type: "ProductDetached"; menuId: string; productId: string; restaurantId: string; at: string }
  | { type: "ProductFeatured"; menuId: string; productId: string; restaurantId: string; at: string };

export type CatalogEventListener = (e: CatalogDomainEvent) => void | Promise<void>;

class Bus {
  private readonly listeners = new Set<CatalogEventListener>();
  subscribe(l: CatalogEventListener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  async publish(event: CatalogDomainEvent) {
    await Promise.all(Array.from(this.listeners).map((l) => {
      try { return Promise.resolve(l(event)); }
      catch (e) { console.error("[CatalogEventBus] listener failed", e); return Promise.resolve(); }
    }));
  }
  clear() { this.listeners.clear(); }
}

export const CatalogEventBus = new Bus();
