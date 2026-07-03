import { describe, it, expect, beforeEach } from "vitest";
import { createRecipeService, type RecipeRepository } from "./RecipeService";
import { RecipeEventBus } from "./RecipeEventBus";
import { validateRecipe } from "./RecipeValidator";
import { RecipeCostEngine } from "./RecipeCostEngine";
import { simulateProduction } from "./RecipeSimulation";
import type { Recipe, RecipeItem, RecipeItemInput, RecipeVersionSnapshot } from "./types";
import type { Ingredient } from "@/lib/inventory/types";
import { createInventoryService, type InventoryRepository } from "@/lib/inventory/InventoryService";
import type { StockMovement } from "@/lib/inventory/types";

function makeIngRepo(seed: Ingredient[]): InventoryRepository & { movements: StockMovement[] } {
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

function makeRecipeRepo(ingRepo: { listIngredients(r: string): Promise<Ingredient[]> }): RecipeRepository {
  const recipes = new Map<string, Recipe>();
  const items = new Map<string, RecipeItem[]>();
  const versions: RecipeVersionSnapshot[] = [];
  let seq = 0;
  return {
    async listIngredients(r) { return ingRepo.listIngredients(r); },
    async createRecipe(r) { const id = `rec${++seq}`; const full: Recipe = { ...r, id }; recipes.set(id, full); items.set(id, []); return full; },
    async updateRecipe(id, patch) { const n = { ...recipes.get(id)!, ...patch } as Recipe; recipes.set(id, n); return n; },
    async getRecipe(id) { return recipes.get(id) ?? null; },
    async listRecipes(rid, filter) {
      return [...recipes.values()].filter((r) => r.restaurant_id === rid
        && (!filter?.productId || r.product_id === filter.productId)
        && (!filter?.status || r.status === filter.status));
    },
    async replaceItems(rid, its: RecipeItemInput[]) {
      const list: RecipeItem[] = its.map((it, idx) => ({
        id: `ri${++seq}`, recipe_id: rid, ingredient_id: it.ingredient_id,
        quantity: it.quantity, unit: it.unit ?? "un", loss_percentage: it.loss_percentage ?? 0,
        optional: it.optional ?? false, substitute_of: it.substitute_of ?? null, display_order: it.display_order ?? idx,
      }));
      items.set(rid, list); return list;
    },
    async listItems(rid) { return items.get(rid) ?? []; },
    async saveVersion(v) { const full = { ...v, id: `v${++seq}` } as RecipeVersionSnapshot; versions.push(full); return full; },
    async listVersions(rid) { return versions.filter((v) => v.recipe_id === rid); },
  };
}

const ing = (id: string, over: Partial<Ingredient> = {}): Ingredient => ({
  id, restaurant_id: "r1", name: id, unit: "kg", stock: 10, reserved_stock: 0,
  min_stock: 1, unit_cost: 5, active: true, ...over,
});

describe("RecipeService", () => {
  beforeEach(() => RecipeEventBus.clear());

  it("creates a recipe with valid ingredients", async () => {
    const invRepo = makeIngRepo([ing("i1"), ing("i2")]);
    const svc = createRecipeService({ repo: makeRecipeRepo(invRepo) });
    const r = await svc.create({
      restaurant_id: "r1", name: "Pizza M", yield_quantity: 1, yield_unit: "un",
      items: [{ ingredient_id: "i1", quantity: 0.2 }, { ingredient_id: "i2", quantity: 0.1 }],
    });
    expect(r.version).toBe(1);
    expect(r.status).toBe("DRAFT");
  });

  it("edits and bumps version, saving history", async () => {
    const invRepo = makeIngRepo([ing("i1"), ing("i2")]);
    const repo = makeRecipeRepo(invRepo);
    const svc = createRecipeService({ repo });
    const r = await svc.create({
      restaurant_id: "r1", name: "Pizza", items: [{ ingredient_id: "i1", quantity: 0.2 }],
    });
    const u = await svc.update(r.id, { name: "Pizza+", items: [{ ingredient_id: "i1", quantity: 0.3 }] });
    expect(u.version).toBe(2);
    const versions = await svc.versions(r.id);
    expect(versions).toHaveLength(2);
  });

  it("computes cost, per portion and margin", async () => {
    const ings = [ing("i1", { unit_cost: 10 }), ing("i2", { unit_cost: 4 })];
    const invRepo = makeIngRepo(ings);
    const svc = createRecipeService({ repo: makeRecipeRepo(invRepo) });
    const r = await svc.create({
      restaurant_id: "r1", name: "Combo", yield_quantity: 2,
      items: [{ ingredient_id: "i1", quantity: 1 }, { ingredient_id: "i2", quantity: 2, loss_percentage: 20 }],
    });
    const c = await svc.cost(r.id, 30);
    expect(c.totalCost).toBeCloseTo(10 + (2 / 0.8) * 4, 4);
    expect(c.costPerPortion).toBeCloseTo(c.totalCost / 2, 4);
    expect(c.grossProfit).toBeCloseTo(30 - c.costPerPortion, 4);
  });

  it("rejects invalid recipes (empty / dup / missing / negative)", () => {
    const ings = [ing("i1")];
    expect(validateRecipe([], ings).valid).toBe(false);
    expect(validateRecipe([{ ingredient_id: "i1", quantity: 1 }, { ingredient_id: "i1", quantity: 2 }], ings).valid).toBe(false);
    expect(validateRecipe([{ ingredient_id: "iX", quantity: 1 }], ings).valid).toBe(false);
    expect(validateRecipe([{ ingredient_id: "i1", quantity: -1 }], ings).valid).toBe(false);
    expect(validateRecipe([{ ingredient_id: "i1", quantity: 1 }], ings).valid).toBe(true);
  });

  it("supports variations via variation_key", async () => {
    const invRepo = makeIngRepo([ing("i1")]);
    const svc = createRecipeService({ repo: makeRecipeRepo(invRepo) });
    const a = await svc.create({ restaurant_id: "r1", name: "Pizza P", variation_key: "P",
      items: [{ ingredient_id: "i1", quantity: 0.1 }] });
    const b = await svc.create({ restaurant_id: "r1", name: "Pizza G", variation_key: "G",
      items: [{ ingredient_id: "i1", quantity: 0.3 }] });
    expect(a.variation_key).toBe("P");
    expect(b.variation_key).toBe("G");
  });

  it("duplicates a recipe with items", async () => {
    const invRepo = makeIngRepo([ing("i1")]);
    const svc = createRecipeService({ repo: makeRecipeRepo(invRepo) });
    const r = await svc.create({ restaurant_id: "r1", name: "Base", items: [{ ingredient_id: "i1", quantity: 0.5 }] });
    const dup = await svc.duplicate(r.id);
    const c = await svc.get(dup.id);
    expect(c?.items).toHaveLength(1);
    expect(dup.name).toContain("cópia");
  });

  it("supports optional and substitute items in cost", async () => {
    const ings = [ing("i1", { unit_cost: 10 }), ing("i2", { unit_cost: 100 })];
    const cost = RecipeCostEngine.totalCost(
      [
        { ingredient_id: "i1", quantity: 1 },
        { ingredient_id: "i2", quantity: 1, optional: true },
      ],
      ings,
    );
    expect(cost).toBe(10);
  });

  it("consumes ingredients through InventoryService on production", async () => {
    const invRepo = makeIngRepo([ing("i1", { stock: 5, unit_cost: 2 })]);
    const inventory = createInventoryService(invRepo);
    const svc = createRecipeService({ repo: makeRecipeRepo(invRepo), inventory });
    const r = await svc.create({ restaurant_id: "r1", name: "X", items: [{ ingredient_id: "i1", quantity: 1 }] });
    await svc.setStatus(r.id, "ACTIVE");
    await svc.consumeForOrder(r.id, { multiplier: 2, orderId: "ord1" });
    const [after] = await invRepo.listIngredients("r1");
    expect(after.stock).toBe(3);
    expect(invRepo.movements[0].movement_type).toBe("PRODUCTION");
  });

  it("simulates production capacity and bottleneck", () => {
    const ings = [ing("i1", { stock: 4, unit_cost: 1 }), ing("i2", { stock: 10, unit_cost: 1 })];
    const recipe = { yield_quantity: 1 } as Recipe;
    const items: RecipeItem[] = [
      { id: "a", recipe_id: "r", ingredient_id: "i1", quantity: 1, unit: "un", loss_percentage: 0, optional: false, substitute_of: null, display_order: 0 },
      { id: "b", recipe_id: "r", ingredient_id: "i2", quantity: 1, unit: "un", loss_percentage: 0, optional: false, substitute_of: null, display_order: 1 },
    ];
    const sim = simulateProduction(recipe, items, ings, 10, 5);
    expect(sim.possiblePortions).toBe(4);
    expect(sim.bottleneck).toBe("i1");
  });

  it("emits lifecycle events", async () => {
    const invRepo = makeIngRepo([ing("i1")]);
    const svc = createRecipeService({ repo: makeRecipeRepo(invRepo) });
    const seen: string[] = [];
    RecipeEventBus.on("RecipeCreated", () => seen.push("c"));
    RecipeEventBus.on("RecipeActivated", () => seen.push("a"));
    RecipeEventBus.on("RecipeArchived", () => seen.push("x"));
    const r = await svc.create({ restaurant_id: "r1", name: "Z", items: [{ ingredient_id: "i1", quantity: 1 }] });
    await svc.setStatus(r.id, "ACTIVE");
    await svc.setStatus(r.id, "ARCHIVED");
    expect(seen).toEqual(["c", "a", "x"]);
  });
});
