import type { Ingredient, MovementInput, MovementType, StockMovement } from "./types";
import { validateMovement } from "./InventoryValidator";
import { InventoryEventBus } from "./InventoryEventBus";
import { InventoryAudit } from "./InventoryAudit";
import { evaluateAlerts } from "./StockAlerts";

/**
 * Minimal storage adapter contract. In production this is backed by Supabase;
 * unit tests inject an in-memory implementation.
 */
export interface InventoryRepository {
  getIngredient(id: string): Promise<Ingredient | null>;
  listIngredients(restaurantId: string): Promise<Ingredient[]>;
  updateIngredient(id: string, patch: Partial<Ingredient>): Promise<Ingredient>;
  recordMovement(m: Omit<StockMovement, "id" | "created_at">): Promise<StockMovement>;
}

const cache = new Map<string, { at: number; data: Ingredient[] }>();
const TTL = 15_000;

async function apply(
  repo: InventoryRepository,
  input: MovementInput,
  type: MovementType,
  computeNext: (ing: Ingredient) => { stock: number; reserved: number },
): Promise<StockMovement> {
  const ing = await repo.getIngredient(input.ingredientId);
  const v = validateMovement(ing, type, input.quantity);
  if (!v.valid || !ing) throw new Error(v.issues.map((i) => i.message).join("; ") || "invalid");

  const prevStock = Number(ing.stock);
  const { stock: newStock, reserved: newReserved } = computeNext(ing);

  await repo.updateIngredient(ing.id, { stock: newStock, reserved_stock: newReserved });
  const movement = await repo.recordMovement({
    ingredient_id: ing.id,
    location_id: input.locationId ?? null,
    movement_type: type,
    quantity: input.quantity,
    previous_stock: prevStock,
    new_stock: newStock,
    reason: input.reason ?? null,
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
    performed_by: input.performedBy ?? null,
    metadata: input.metadata ?? {},
  });

  InventoryAudit.record({
    who: input.performedBy,
    source: input.referenceType ?? "manual",
    movement: type,
    ingredientId: ing.id,
    quantity: input.quantity,
    metadata: input.metadata,
  });

  InventoryEventBus.emit({
    name:
      type === "RESERVE" ? "StockReserved" :
      type === "RELEASE" ? "StockReleased" :
      type === "TRANSFER" ? "StockTransferred" : "StockAdjusted",
    ingredientId: ing.id,
    quantity: input.quantity,
    movementType: type,
    at: new Date().toISOString(),
  });

  if (newStock <= 0) {
    InventoryEventBus.emit({ name: "StockOut", ingredientId: ing.id, at: new Date().toISOString() });
  } else if (newStock <= Number(ing.min_stock ?? 0)) {
    InventoryEventBus.emit({ name: "StockLow", ingredientId: ing.id, at: new Date().toISOString() });
  }

  cache.delete(ing.restaurant_id);
  return movement;
}

export function createInventoryService(repo: InventoryRepository) {
  return {
    async listIngredients(restaurantId: string, opts?: { force?: boolean }) {
      const c = cache.get(restaurantId);
      if (!opts?.force && c && Date.now() - c.at < TTL) return c.data;
      const data = await repo.listIngredients(restaurantId);
      cache.set(restaurantId, { at: Date.now(), data });
      return data;
    },
    alerts(ingredients: Ingredient[]) { return evaluateAlerts(ingredients); },

    reserveStock(input: MovementInput) {
      return apply(repo, input, "RESERVE", (i) => ({
        stock: Number(i.stock),
        reserved: Number(i.reserved_stock ?? 0) + input.quantity,
      }));
    },
    releaseStock(input: MovementInput) {
      return apply(repo, input, "RELEASE", (i) => ({
        stock: Number(i.stock),
        reserved: Math.max(0, Number(i.reserved_stock ?? 0) - input.quantity),
      }));
    },
    decreaseStock(input: MovementInput, type: MovementType = "EXIT") {
      return apply(repo, input, type, (i) => ({
        stock: Number(i.stock) - input.quantity,
        reserved: Math.max(0, Number(i.reserved_stock ?? 0) - Math.min(input.quantity, Number(i.reserved_stock ?? 0))),
      }));
    },
    increaseStock(input: MovementInput, type: MovementType = "ENTRY") {
      return apply(repo, input, type, (i) => ({
        stock: Number(i.stock) + input.quantity,
        reserved: Number(i.reserved_stock ?? 0),
      }));
    },
    adjustStock(input: MovementInput & { targetStock: number }) {
      return apply(repo, { ...input, quantity: input.targetStock }, "ADJUSTMENT", () => ({
        stock: input.targetStock,
        reserved: 0,
      }));
    },
    async transferStock(input: MovementInput & { toLocationId: string }) {
      const out = await apply(repo, input, "TRANSFER", (i) => ({
        stock: Number(i.stock) - input.quantity,
        reserved: Number(i.reserved_stock ?? 0),
      }));
      return out;
    },
    invalidateCache(restaurantId?: string) {
      if (restaurantId) cache.delete(restaurantId);
      else cache.clear();
    },
  };
}

export type InventoryService = ReturnType<typeof createInventoryService>;
