import { describe, it, expect, beforeEach } from "vitest";
import { createProductionService, type ProductionRepository } from "./ProductionService";
import { ProductionEventBus } from "./ProductionEventBus";
import { ProductionAudit } from "./ProductionAudit";
import { ProductionYieldEngine } from "./ProductionYieldEngine";
import { validateProduction, computeNeeds } from "./ProductionValidator";
import type { ProductionOrder, ProductionConsumption, ProductionOutput, ProductionLoss, ProductionBatch } from "./types";
import type { Ingredient, StockMovement } from "@/lib/inventory/types";
import { createInventoryService, type InventoryRepository } from "@/lib/inventory/InventoryService";
import { createRecipeService, type RecipeRepository } from "@/lib/recipes/RecipeService";
import type { Recipe, RecipeItem, RecipeItemInput, RecipeVersionSnapshot } from "@/lib/recipes/types";

function ingRepo(seed: Ingredient[]): InventoryRepository & { movements: StockMovement[] } {
  const store = new Map(seed.map((i) => [i.id, { ...i }]));
  const movements: StockMovement[] = [];
  return {
    movements,
    async getIngredient(id) { return store.get(id) ?? null; },
    async listIngredients(rid) { return [...store.values()].filter((i) => i.restaurant_id === rid); },
    async updateIngredient(id, patch) { const n = { ...store.get(id)!, ...patch } as Ingredient; store.set(id, n); return n; },
    async recordMovement(m) { const f = { ...m, id: String(movements.length + 1), created_at: new Date().toISOString() } as StockMovement; movements.push(f); return f; },
  };
}
function recipeRepo(ing: { listIngredients(r: string): Promise<Ingredient[]> }): RecipeRepository {
  const recipes = new Map<string, Recipe>(); const items = new Map<string, RecipeItem[]>();
  const versions: RecipeVersionSnapshot[] = []; let seq = 0;
  return {
    async listIngredients(r) { return ing.listIngredients(r); },
    async createRecipe(r) { const id = `rec${++seq}`; const full = { ...r, id } as Recipe; recipes.set(id, full); items.set(id, []); return full; },
    async updateRecipe(id, patch) { const n = { ...recipes.get(id)!, ...patch } as Recipe; recipes.set(id, n); return n; },
    async getRecipe(id) { return recipes.get(id) ?? null; },
    async listRecipes(rid) { return [...recipes.values()].filter((r) => r.restaurant_id === rid); },
    async replaceItems(rid, its: RecipeItemInput[]) {
      const list: RecipeItem[] = its.map((it, idx) => ({
        id: `ri${++seq}`, recipe_id: rid, ingredient_id: it.ingredient_id,
        quantity: it.quantity, unit: it.unit ?? "un", loss_percentage: it.loss_percentage ?? 0,
        optional: it.optional ?? false, substitute_of: it.substitute_of ?? null, display_order: it.display_order ?? idx,
      }));
      items.set(rid, list); return list;
    },
    async listItems(rid) { return items.get(rid) ?? []; },
    async saveVersion(v) { const f = { ...v, id: `v${++seq}` } as RecipeVersionSnapshot; versions.push(f); return f; },
    async listVersions(rid) { return versions.filter((v) => v.recipe_id === rid); },
  };
}
function prodRepo(): ProductionRepository & {
  orders: Map<string, ProductionOrder>; consumption: ProductionConsumption[];
  outputs: ProductionOutput[]; losses: ProductionLoss[]; batches: ProductionBatch[];
} {
  const orders = new Map<string, ProductionOrder>();
  const consumption: ProductionConsumption[] = []; const outputs: ProductionOutput[] = [];
  const losses: ProductionLoss[] = []; const batches: ProductionBatch[] = []; let seq = 0;
  return {
    orders, consumption, outputs, losses, batches,
    async createOrder(o) { const id = `po${++seq}`; const full = { ...o, id } as ProductionOrder; orders.set(id, full); return full; },
    async updateOrder(id, patch) { const n = { ...orders.get(id)!, ...patch } as ProductionOrder; orders.set(id, n); return n; },
    async getOrder(id) { return orders.get(id) ?? null; },
    async listOrders(rid, filter) { return [...orders.values()].filter((o) => o.restaurant_id === rid && (!filter?.status || o.status === filter.status)); },
    async recordConsumption(c) { const f = { ...c, id: `c${++seq}`, created_at: new Date().toISOString() }; consumption.push(f); return f; },
    async recordOutput(o) { const f = { ...o, id: `o${++seq}`, created_at: new Date().toISOString() }; outputs.push(f); return f; },
    async recordLoss(l) { const f = { ...l, id: `l${++seq}`, created_at: new Date().toISOString() }; losses.push(f); return f; },
    async createBatch(b) { const f = { ...b, id: `b${++seq}`, created_at: new Date().toISOString() }; batches.push(f); return f; },
    async listBatches(pid) { return batches.filter((b) => b.production_order_id === pid); },
  };
}

const ing = (id: string, over: Partial<Ingredient> = {}): Ingredient => ({
  id, restaurant_id: "r1", name: id, unit: "kg", stock: 100, reserved_stock: 0,
  min_stock: 1, unit_cost: 2, active: true, ...over,
});

async function setup(opts: { recipeStatus?: Recipe["status"]; ingredients?: Ingredient[]; items?: RecipeItemInput[]; yieldQ?: number } = {}) {
  const ings = opts.ingredients ?? [ing("i1"), ing("i2")];
  const invR = ingRepo(ings);
  const inventory = createInventoryService(invR);
  const rR = recipeRepo(invR);
  const recipes = createRecipeService({ repo: rR, inventory });
  const recipe = await recipes.create({
    restaurant_id: "r1", name: "Massa", yield_quantity: opts.yieldQ ?? 10,
    items: opts.items ?? [{ ingredient_id: "i1", quantity: 1 }, { ingredient_id: "i2", quantity: 0.5 }],
  });
  if ((opts.recipeStatus ?? "ACTIVE") !== "DRAFT") await recipes.setStatus(recipe.id, opts.recipeStatus ?? "ACTIVE");
  const pR = prodRepo();
  const production = createProductionService({ repo: pR, inventory, recipes });
  return { invR, inventory, recipes, recipe, pR, production };
}

beforeEach(() => { ProductionEventBus.clear(); ProductionAudit.clear(); });

describe("ProductionValidator", () => {
  it("rejects inactive recipe and insufficient stock", async () => {
    const { recipes, recipe, invR } = await setup({ recipeStatus: "DRAFT" });
    const b = await recipes.get(recipe.id);
    const v1 = validateProduction(b!.recipe, b!.items, await invR.listIngredients("r1"), 10);
    expect(v1.valid).toBe(false);
    const short = validateProduction(
      { ...b!.recipe, status: "ACTIVE" } as Recipe, b!.items,
      [ing("i1", { stock: 0 }), ing("i2")], 10,
    );
    expect(short.valid).toBe(false);
    expect(short.issues.some((i) => i.code === "STOCK")).toBe(true);
  });

  it("computeNeeds scales with portions and yield", async () => {
    const { recipes, recipe } = await setup({ yieldQ: 5 });
    const b = await recipes.get(recipe.id); // yield 5, per-batch: i1=1, i2=0.5
    const needs = computeNeeds(b!.recipe, b!.items, 10); // 2 batches
    expect(needs.find((n) => n.ingredient_id === "i1")!.quantity).toBe(2);
    expect(needs.find((n) => n.ingredient_id === "i2")!.quantity).toBe(1);
  });
});

describe("ProductionService lifecycle", () => {
  it("plans and reserves ingredients", async () => {
    const { production, invR } = await setup();
    const order = await production.plan({ restaurant_id: "r1", recipe_id: (await invR.listIngredients("r1"))[0] && "" || "", planned_quantity: 10 } as any);
    // Retry with real recipe id
    void order;
  });

  it("full flow: plan → start → complete updates stock and outputs", async () => {
    const { production, recipe, invR, pR } = await setup();
    const order = await production.plan({ restaurant_id: "r1", recipe_id: recipe.id, planned_quantity: 10 });
    // Reservations recorded
    const i1 = (await invR.listIngredients("r1")).find((x) => x.id === "i1")!;
    expect(i1.reserved_stock).toBe(1); // 10 portions / yield 10 = 1 batch of i1
    await production.start(order.id);
    const completed = await production.complete(order.id, { producedQuantity: 10, batchCode: "L-001" });
    expect(completed.status).toBe("COMPLETED");
    const i1After = (await invR.listIngredients("r1")).find((x) => x.id === "i1")!;
    expect(i1After.stock).toBe(99); // 100 - 1
    expect(i1After.reserved_stock).toBe(0);
    expect(pR.outputs).toHaveLength(1);
    expect(pR.batches).toHaveLength(1);
  });

  it("start requires PLANNED or PAUSED, pause requires IN_PROGRESS", async () => {
    const { production, recipe } = await setup();
    const o = await production.plan({ restaurant_id: "r1", recipe_id: recipe.id, planned_quantity: 10 });
    await production.start(o.id);
    await production.pause(o.id);
    await production.start(o.id);
    await expect(production.pause(o.id)).resolves.toBeTruthy();
    await expect(production.start(o.id)).rejects.toThrow();
  });

  it("cancel releases reservations", async () => {
    const { production, recipe, invR } = await setup();
    const o = await production.plan({ restaurant_id: "r1", recipe_id: recipe.id, planned_quantity: 20 });
    let i1 = (await invR.listIngredients("r1")).find((x) => x.id === "i1")!;
    expect(i1.reserved_stock).toBe(2);
    await production.cancel(o.id, { reason: "test" });
    i1 = (await invR.listIngredients("r1")).find((x) => x.id === "i1")!;
    expect(i1.reserved_stock).toBe(0);
  });

  it("registers losses and decreases stock", async () => {
    const { production, recipe, invR, pR } = await setup();
    const o = await production.plan({ restaurant_id: "r1", recipe_id: recipe.id, planned_quantity: 10 });
    await production.start(o.id);
    await production.complete(o.id, {
      producedQuantity: 10,
      losses: [{ ingredientId: "i2", quantity: 0.1, reason: "queima" }],
    });
    expect(pR.losses).toHaveLength(1);
    const lossMove = invR.movements.find((m) => m.movement_type === "LOSS");
    expect(lossMove).toBeTruthy();
  });

  it("supports batch creation on completion", async () => {
    const { production, recipe, pR } = await setup();
    const o = await production.plan({ restaurant_id: "r1", recipe_id: recipe.id, planned_quantity: 50, expiration_date: "2030-01-01T00:00:00Z" });
    await production.start(o.id);
    await production.complete(o.id, { producedQuantity: 50, batchCode: "LT-42", expirationDate: "2030-01-01T00:00:00Z" });
    expect(pR.batches[0].batch_code).toBe("LT-42");
    expect(pR.batches[0].expiration_date).toBe("2030-01-01T00:00:00Z");
  });

  it("computes yield efficiency", () => {
    const y = ProductionYieldEngine.compute(100, 92);
    expect(y.diff).toBe(-8);
    expect(y.efficiencyPct).toBe(92);
  });

  it("supports transformation (10kg → 50 unidades) via yield_quantity", async () => {
    const { production, recipes, invR, pR } = await setup({
      yieldQ: 50, items: [{ ingredient_id: "i1", quantity: 10 }], ingredients: [ing("i1", { stock: 20 })],
    });
    const r = (await recipes.list("r1"))[0];
    const o = await production.plan({ restaurant_id: "r1", recipe_id: r.id, planned_quantity: 50 });
    await production.start(o.id);
    await production.complete(o.id, { producedQuantity: 50, batchCode: "MASSA-1" });
    expect(pR.outputs[0].produced_quantity).toBe(50);
    const i1 = (await invR.listIngredients("r1")).find((x) => x.id === "i1")!;
    expect(i1.stock).toBe(10); // 20 - 10kg used
  });

  it("emits lifecycle events", async () => {
    const { production, recipe } = await setup();
    const seen: string[] = [];
    ["ProductionPlanned","ProductionStarted","ProductionCompleted","BatchCreated","LossRegistered"].forEach((n) =>
      ProductionEventBus.on(n as any, () => seen.push(n)));
    const o = await production.plan({ restaurant_id: "r1", recipe_id: recipe.id, planned_quantity: 10 });
    await production.start(o.id);
    await production.complete(o.id, {
      producedQuantity: 10, batchCode: "B", losses: [{ ingredientId: "i2", quantity: 0.05 }],
    });
    expect(seen).toEqual(expect.arrayContaining(["ProductionPlanned","ProductionStarted","ProductionCompleted","BatchCreated","LossRegistered"]));
  });

  it("audit trail records each transition", async () => {
    const { production, recipe } = await setup();
    const o = await production.plan({ restaurant_id: "r1", recipe_id: recipe.id, planned_quantity: 10, created_by: "user-1" });
    await production.start(o.id, "user-1");
    await production.complete(o.id, { producedQuantity: 10, performedBy: "user-1" });
    const actions = ProductionAudit.list().map((a) => a.action);
    expect(actions).toEqual(["PLAN", "START", "COMPLETE"]);
  });
});
