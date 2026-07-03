import type { ReceivingLine } from "./types";
import { PurchaseEventBus } from "./PurchaseEventBus";

/**
 * ReceivingService — recebe mercadorias e delega para InventoryService e CostEngine.
 * Nunca altera histórico financeiro: apenas insere novos snapshots.
 */
export interface InventoryServicePort {
  increaseStock(input: {
    ingredientId: string;
    quantity: number;
    referenceType?: string;
    referenceId?: string;
    unitCost?: number;
    batchCode?: string;
    expiresAt?: string;
    performedBy?: string;
  }): Promise<unknown>;
}

export interface CostEnginePort {
  calculateIngredientCost(input: {
    restaurant_id: string;
    ingredient_id: string;
    unit_cost: number;
    supplier_id?: string | null;
    purchase_order_id?: string | null;
    previousAverage?: number | null;
    previousQty?: number;
    addedQty?: number;
  }): Promise<unknown>;
}

export class ReceivingService {
  constructor(
    private inventory: InventoryServicePort,
    private cost: CostEnginePort,
    private restaurantId: string,
  ) {}

  async receive(lines: ReceivingLine[], meta: { performedBy?: string; purchaseOrderId?: string } = {}) {
    for (const line of lines) {
      await this.inventory.increaseStock({
        ingredientId: line.ingredient_id,
        quantity: line.quantity,
        referenceType: "purchase",
        referenceId: meta.purchaseOrderId ?? line.purchase_order_id,
        unitCost: line.unit_cost,
        batchCode: line.batch_code,
        expiresAt: line.expires_at,
        performedBy: meta.performedBy,
      });
      await this.cost.calculateIngredientCost({
        restaurant_id: this.restaurantId,
        ingredient_id: line.ingredient_id,
        unit_cost: line.unit_cost,
        supplier_id: line.supplier_id ?? null,
        purchase_order_id: meta.purchaseOrderId ?? line.purchase_order_id ?? null,
        addedQty: line.quantity,
      });
      PurchaseEventBus.emit({
        name: "CostUpdated",
        ingredientId: line.ingredient_id,
        unitCost: line.unit_cost,
      });
    }
    PurchaseEventBus.emit({
      name: "PurchaseReceived",
      purchaseOrderId: meta.purchaseOrderId,
      lines: lines.length,
    });
    return { received: lines.length };
  }
}
