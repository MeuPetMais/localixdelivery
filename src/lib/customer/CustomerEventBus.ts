import type { CustomerTimelineEventType } from "./types";

export type CustomerDomainEvent =
  | { type: "CustomerCreated"; customerId: string; at: string }
  | { type: "CustomerUpdated"; customerId: string; changes: Record<string, unknown>; at: string }
  | { type: "AddressAdded"; customerId: string; addressId: string; at: string }
  | { type: "AddressChanged"; customerId: string; addressId: string; at: string }
  | { type: "PreferenceChanged"; customerId: string; changes: Record<string, unknown>; at: string }
  | { type: "FavoriteAdded"; customerId: string; targetType: "product" | "restaurant" | "category"; targetId: string; at: string }
  | { type: "FavoriteRemoved"; customerId: string; targetType: "product" | "restaurant" | "category"; targetId: string; at: string }
  | { type: "ConsentUpdated"; customerId: string; consentType: string; granted: boolean; at: string }
  | { type: "TimelineEventCreated"; customerId: string; eventType: CustomerTimelineEventType; at: string };

export type CustomerEventListener = (event: CustomerDomainEvent) => void | Promise<void>;

class Bus {
  private readonly listeners = new Set<CustomerEventListener>();
  subscribe(listener: CustomerEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async publish(event: CustomerDomainEvent): Promise<void> {
    await Promise.all(
      Array.from(this.listeners).map((l) => {
        try {
          return Promise.resolve(l(event));
        } catch {
          return Promise.resolve();
        }
      }),
    );
  }
  clear(): void {
    this.listeners.clear();
  }
}

export const CustomerEventBus = new Bus();
