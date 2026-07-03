import type { MovementType } from "./types";

export type InventoryEventName =
  | "StockReserved"
  | "StockReleased"
  | "StockAdjusted"
  | "StockTransferred"
  | "StockLow"
  | "StockOut"
  | "PurchaseOrderCreated"
  | "PurchaseOrderReceived";

export interface InventoryEvent {
  name: InventoryEventName;
  ingredientId?: string;
  quantity?: number;
  movementType?: MovementType;
  payload?: Record<string, unknown>;
  at: string;
}

type Handler = (event: InventoryEvent) => void;

const handlers = new Map<InventoryEventName, Set<Handler>>();

export const InventoryEventBus = {
  on(name: InventoryEventName, handler: Handler): () => void {
    const set = handlers.get(name) ?? new Set<Handler>();
    set.add(handler);
    handlers.set(name, set);
    return () => set.delete(handler);
  },
  emit(event: InventoryEvent) {
    handlers.get(event.name)?.forEach((h) => {
      try { h(event); } catch { /* swallow */ }
    });
  },
  clear() { handlers.clear(); },
};
