import type { Ingredient, MovementInput, MovementType, StockMovement } from "./types";
import { createInventoryService, type InventoryRepository } from "./InventoryService";

/** Wrapper so external callers only invoke movements through the service (never raw SQL). */
export function createStockMovementService(repo: InventoryRepository) {
  const inv = createInventoryService(repo);
  return {
    record(type: MovementType, input: MovementInput): Promise<StockMovement> {
      switch (type) {
        case "ENTRY": return inv.increaseStock(input, "ENTRY");
        case "SALE": return inv.decreaseStock(input, "SALE");
        case "EXIT": return inv.decreaseStock(input, "EXIT");
        case "LOSS": return inv.decreaseStock(input, "LOSS");
        case "PRODUCTION": return inv.decreaseStock(input, "PRODUCTION");
        case "RESERVE": return inv.reserveStock(input);
        case "RELEASE": return inv.releaseStock(input);
        case "ADJUSTMENT":
          return inv.adjustStock({ ...input, targetStock: input.quantity });
        case "TRANSFER":
          return inv.transferStock({ ...input, toLocationId: (input.metadata?.toLocationId as string) ?? "" });
      }
    },
    _inventory: inv as unknown as { listIngredients: (r: string) => Promise<Ingredient[]> },
  };
}

export type StockMovementService = ReturnType<typeof createStockMovementService>;
