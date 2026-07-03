import type {
  ProductionOrder, ProductionConsumption, ProductionOutput,
  ProductionLoss, ProductionBatch, PlanProductionInput, CompleteProductionInput,
} from "./types";
import { computeNeeds, validateProduction } from "./ProductionValidator";
import { ProductionEventBus } from "./ProductionEventBus";
import { ProductionAudit } from "./ProductionAudit";
import { ProductionYieldEngine } from "./ProductionYieldEngine";
import { ProductionLossEngine } from "./ProductionLossEngine";
import type { InventoryService } from "@/lib/inventory/InventoryService";
import type { RecipeService } from "@/lib/recipes/RecipeService";

export interface ProductionRepository {
  createOrder(o: Omit<ProductionOrder, "id" | "created_at" | "updated_at">): Promise<ProductionOrder>;
  updateOrder(id: string, patch: Partial<ProductionOrder>): Promise<ProductionOrder>;
  getOrder(id: string): Promise<ProductionOrder | null>;
  listOrders(restaurantId: string, filter?: { status?: ProductionOrder["status"] }): Promise<ProductionOrder[]>;
  recordConsumption(c: Omit<ProductionConsumption, "id" | "created_at">): Promise<ProductionConsumption>;
  recordOutput(o: Omit<ProductionOutput, "id" | "created_at">): Promise<ProductionOutput>;
  recordLoss(l: Omit<ProductionLoss, "id" | "created_at">): Promise<ProductionLoss>;
  createBatch(b: Omit<ProductionBatch, "id" | "created_at">): Promise<ProductionBatch>;
  listBatches(productionOrderId: string): Promise<ProductionBatch[]>;
}

export interface ProductionDeps {
  repo: ProductionRepository;
  inventory: InventoryService;
  recipes: RecipeService;
}

function nowIso() { return new Date().toISOString(); }

export function createProductionService({ repo, inventory, recipes }: ProductionDeps) {
  async function loadRecipe(recipeId: string) {
    const bundle = await recipes.get(recipeId);
    if (!bundle) throw new Error("Recipe not found");
    return bundle;
  }

  return {
    async list(restaurantId: string, filter?: Parameters<ProductionRepository["listOrders"]>[1]) {
      return repo.listOrders(restaurantId, filter);
    },
    async get(id: string) { return repo.getOrder(id); },
    async listBatches(id: string) { return repo.listBatches(id); },

    async plan(input: PlanProductionInput) {
      const bundle = await loadRecipe(input.recipe_id);
      const ingredients = await inventory.listIngredients(input.restaurant_id, { force: true });
      const v = validateProduction(bundle.recipe, bundle.items, ingredients, input.planned_quantity);
      if (!v.valid) throw new Error(v.issues.map((i) => i.message).join("; "));

      const order = await repo.createOrder({
        restaurant_id: input.restaurant_id,
        recipe_id: input.recipe_id,
        batch_number: input.batch_number ?? null,
        planned_quantity: input.planned_quantity,
        produced_quantity: 0,
        status: "PLANNED",
        planned_start: input.planned_start ?? null,
        actual_start: null,
        actual_finish: null,
        expiration_date: input.expiration_date ?? null,
        notes: input.notes ?? null,
        created_by: input.created_by ?? null,
        metadata: input.metadata ?? {},
      });

      // Reserve ingredients so parallel orders don't over-commit stock.
      for (const need of computeNeeds(bundle.recipe, bundle.items, input.planned_quantity)) {
        if (need.quantity <= 0) continue;
        await inventory.reserveStock({
          ingredientId: need.ingredient_id,
          quantity: need.quantity,
          referenceType: "production",
          referenceId: order.id,
          performedBy: input.created_by ?? undefined,
        });
        await repo.recordConsumption({
          production_order_id: order.id,
          ingredient_id: need.ingredient_id,
          planned_quantity: need.quantity,
          consumed_quantity: 0,
          loss_quantity: 0,
        });
      }

      ProductionAudit.record({ who: input.created_by ?? null, action: "PLAN", productionId: order.id, data: { planned: input.planned_quantity } });
      ProductionEventBus.emit({ name: "ProductionPlanned", productionId: order.id, at: nowIso() });
      return order;
    },

    async start(id: string, performedBy?: string) {
      const order = await repo.getOrder(id);
      if (!order) throw new Error("Order not found");
      if (order.status !== "PLANNED" && order.status !== "PAUSED") throw new Error(`Cannot start from ${order.status}`);
      const patch: Partial<ProductionOrder> = { status: "IN_PROGRESS" };
      if (!order.actual_start) patch.actual_start = nowIso();
      const next = await repo.updateOrder(id, patch);
      ProductionAudit.record({ who: performedBy ?? null, action: "START", productionId: id });
      ProductionEventBus.emit({ name: order.status === "PAUSED" ? "ProductionResumed" : "ProductionStarted", productionId: id, at: nowIso() });
      return next;
    },

    async pause(id: string, performedBy?: string) {
      const order = await repo.getOrder(id);
      if (!order) throw new Error("Order not found");
      if (order.status !== "IN_PROGRESS") throw new Error(`Cannot pause from ${order.status}`);
      const next = await repo.updateOrder(id, { status: "PAUSED" });
      ProductionAudit.record({ who: performedBy ?? null, action: "PAUSE", productionId: id });
      ProductionEventBus.emit({ name: "ProductionPaused", productionId: id, at: nowIso() });
      return next;
    },

    async cancel(id: string, opts: { performedBy?: string; reason?: string } = {}) {
      const order = await repo.getOrder(id);
      if (!order) throw new Error("Order not found");
      if (order.status === "COMPLETED") throw new Error("Cannot cancel completed order");
      // Release any reservations.
      const bundle = await loadRecipe(order.recipe_id);
      for (const need of computeNeeds(bundle.recipe, bundle.items, order.planned_quantity)) {
        if (need.quantity <= 0) continue;
        await inventory.releaseStock({
          ingredientId: need.ingredient_id,
          quantity: need.quantity,
          referenceType: "production",
          referenceId: order.id,
          performedBy: opts.performedBy,
        }).catch(() => { /* best-effort */ });
      }
      const next = await repo.updateOrder(id, { status: "CANCELLED", actual_finish: nowIso(), notes: opts.reason ?? order.notes });
      ProductionAudit.record({ who: opts.performedBy ?? null, action: "CANCEL", productionId: id, data: { reason: opts.reason } });
      ProductionEventBus.emit({ name: "ProductionCancelled", productionId: id, at: nowIso() });
      return next;
    },

    async fail(id: string, reason: string, performedBy?: string) {
      await this.cancel(id, { performedBy, reason });
      const next = await repo.updateOrder(id, { status: "FAILED" });
      ProductionEventBus.emit({ name: "ProductionFailed", productionId: id, at: nowIso(), data: { reason } });
      return next;
    },

    async complete(id: string, input: CompleteProductionInput) {
      const order = await repo.getOrder(id);
      if (!order) throw new Error("Order not found");
      if (order.status !== "IN_PROGRESS" && order.status !== "PAUSED" && order.status !== "PLANNED") {
        throw new Error(`Cannot complete from ${order.status}`);
      }
      const bundle = await loadRecipe(order.recipe_id);
      const ingredients = await inventory.listIngredients(order.restaurant_id, { force: true });

      // Actual consumption is proportional to the produced quantity.
      const producedRatio = order.planned_quantity > 0 ? input.producedQuantity / order.planned_quantity : 1;
      const planned = computeNeeds(bundle.recipe, bundle.items, order.planned_quantity);
      const consumed = computeNeeds(bundle.recipe, bundle.items, input.producedQuantity);

      // Release full reservation, then decrease actual consumed.
      for (const p of planned) {
        if (p.quantity > 0) {
          await inventory.releaseStock({
            ingredientId: p.ingredient_id, quantity: p.quantity,
            referenceType: "production", referenceId: id,
          }).catch(() => { /* best-effort */ });
        }
      }
      for (const c of consumed) {
        if (c.quantity <= 0) continue;
        await inventory.decreaseStock({
          ingredientId: c.ingredient_id, quantity: c.quantity,
          referenceType: "production", referenceId: id,
          performedBy: input.performedBy,
          metadata: { recipe_id: order.recipe_id },
        }, "PRODUCTION");
        const plannedForIng = planned.find((p) => p.ingredient_id === c.ingredient_id)?.quantity ?? c.quantity;
        await repo.recordConsumption({
          production_order_id: id,
          ingredient_id: c.ingredient_id,
          planned_quantity: plannedForIng,
          consumed_quantity: c.quantity,
          loss_quantity: Math.max(0, plannedForIng * producedRatio - c.quantity),
        });
      }

      // Explicit losses
      const losses = ProductionLossEngine.compute(input.losses ?? [], ingredients);
      for (const l of losses) {
        await repo.recordLoss({
          production_order_id: id, ingredient_id: l.ingredientId,
          quantity: l.quantity, reason: l.reason, cost: l.cost,
        });
        if (l.ingredientId && l.quantity > 0) {
          await inventory.decreaseStock({
            ingredientId: l.ingredientId, quantity: l.quantity,
            referenceType: "production", referenceId: id, reason: l.reason ?? "loss",
            performedBy: input.performedBy,
          }, "LOSS").catch(() => { /* best-effort */ });
        }
        ProductionEventBus.emit({ name: "LossRegistered", productionId: id, at: nowIso(), data: { ingredientId: l.ingredientId, quantity: l.quantity } });
      }

      const approved = input.approvedQuantity ?? input.producedQuantity;
      const rejected = input.rejectedQuantity ?? 0;
      await repo.recordOutput({
        production_order_id: id,
        product_id: bundle.recipe.product_id,
        produced_quantity: input.producedQuantity,
        approved_quantity: approved,
        rejected_quantity: rejected,
      });

      let batch: ProductionBatch | undefined;
      if (input.batchCode) {
        batch = await repo.createBatch({
          production_order_id: id,
          batch_code: input.batchCode,
          manufacturing_date: nowIso(),
          expiration_date: input.expirationDate ?? order.expiration_date,
          status: "ACTIVE",
          quantity: approved,
        });
        ProductionEventBus.emit({ name: "BatchCreated", productionId: id, at: nowIso(), data: { batchId: batch.id, code: input.batchCode } });
      }

      const next = await repo.updateOrder(id, {
        status: "COMPLETED",
        produced_quantity: input.producedQuantity,
        actual_finish: nowIso(),
      });

      ProductionAudit.record({
        who: input.performedBy ?? null, action: "COMPLETE", productionId: id,
        data: { produced: input.producedQuantity, approved, rejected, losses: losses.length, batchId: batch?.id },
      });
      ProductionEventBus.emit({
        name: "ProductionCompleted", productionId: id, at: nowIso(),
        data: {
          ...ProductionYieldEngine.compute(order.planned_quantity, input.producedQuantity),
          lossCost: ProductionLossEngine.totalCost(losses),
        },
      });
      return next;
    },

    async registerLoss(id: string, loss: { ingredientId: string | null; quantity: number; reason?: string; cost?: number; performedBy?: string }) {
      const order = await repo.getOrder(id);
      if (!order) throw new Error("Order not found");
      const ingredients = await inventory.listIngredients(order.restaurant_id);
      const [computed] = ProductionLossEngine.compute([loss], ingredients);
      const rec = await repo.recordLoss({
        production_order_id: id, ingredient_id: computed.ingredientId,
        quantity: computed.quantity, reason: computed.reason, cost: computed.cost,
      });
      if (computed.ingredientId && computed.quantity > 0) {
        await inventory.decreaseStock({
          ingredientId: computed.ingredientId, quantity: computed.quantity,
          referenceType: "production", referenceId: id, reason: computed.reason ?? "loss",
          performedBy: loss.performedBy,
        }, "LOSS").catch(() => { /* best-effort */ });
      }
      ProductionEventBus.emit({ name: "LossRegistered", productionId: id, at: nowIso(), data: { lossId: rec.id } });
      return rec;
    },

    async expireBatches(now = new Date()) {
      const expired: ProductionBatch[] = [];
      // Caller passes a scan; delegated to repo in production. Hook exposed for schedulers.
      return { expired, at: now.toISOString() };
    },
  };
}

export type ProductionService = ReturnType<typeof createProductionService>;
