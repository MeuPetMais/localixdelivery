import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from "./types";
import { InventoryEventBus } from "./InventoryEventBus";
import type { InventoryService } from "./InventoryService";

export interface PurchaseOrderRepository {
  create(po: Omit<PurchaseOrder, "id">, items: Omit<PurchaseOrderItem, "id" | "purchase_order_id" | "total">[]): Promise<PurchaseOrder>;
  updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder>;
  getItems(poId: string): Promise<PurchaseOrderItem[]>;
}

export function createPurchaseOrderService(repo: PurchaseOrderRepository, inventory: InventoryService) {
  return {
    async createDraft(input: Omit<PurchaseOrder, "id" | "status" | "total_cost"> & {
      items: Omit<PurchaseOrderItem, "id" | "purchase_order_id" | "total">[];
    }) {
      const total = input.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const po = await repo.create(
        { ...input, status: "DRAFT", total_cost: total },
        input.items,
      );
      InventoryEventBus.emit({ name: "PurchaseOrderCreated", payload: { poId: po.id }, at: new Date().toISOString() });
      return po;
    },
    updateStatus(id: string, status: PurchaseOrderStatus) { return repo.updateStatus(id, status); },
    async receive(id: string, performedBy?: string) {
      const items = await repo.getItems(id);
      for (const it of items) {
        if (!it.ingredient_id) continue;
        await inventory.increaseStock({
          ingredientId: it.ingredient_id,
          quantity: Number(it.quantity),
          reason: "Purchase received",
          referenceType: "purchase_order",
          referenceId: id,
          performedBy,
        }, "ENTRY");
      }
      const po = await repo.updateStatus(id, "RECEIVED");
      InventoryEventBus.emit({ name: "PurchaseOrderReceived", payload: { poId: id }, at: new Date().toISOString() });
      return po;
    },
  };
}

export type PurchaseOrderService = ReturnType<typeof createPurchaseOrderService>;
