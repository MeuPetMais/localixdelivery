export type PurchaseEvent =
  | { name: "SupplierCreated"; supplierId: string }
  | { name: "SupplierChanged"; supplierId: string; changes: Record<string, unknown> }
  | { name: "PurchaseRequested"; requestId: string; restaurantId: string }
  | { name: "PurchaseApproved"; requestId: string; approvedBy?: string }
  | { name: "PurchaseReceived"; purchaseOrderId?: string; lines: number }
  | { name: "CostUpdated"; ingredientId: string; unitCost: number };

type Handler = (e: PurchaseEvent) => void;

class Bus {
  private handlers = new Set<Handler>();
  on(h: Handler) { this.handlers.add(h); return () => this.handlers.delete(h); }
  emit(e: PurchaseEvent) { this.handlers.forEach(h => { try { h(e); } catch { /* ignore */ } }); }
}

export const PurchaseEventBus = new Bus();
