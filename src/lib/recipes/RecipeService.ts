import type { Recipe, RecipeItem, RecipeInput, RecipeItemInput, RecipeVersionSnapshot } from "./types";
import { validateRecipe } from "./RecipeValidator";
import { RecipeEventBus } from "./RecipeEventBus";
import { RecipeCostEngine } from "./RecipeCostEngine";
import type { Ingredient } from "@/lib/inventory/types";
import type { InventoryService } from "@/lib/inventory/InventoryService";

export interface RecipeRepository {
  createRecipe(r: Omit<Recipe, "id" | "created_at" | "updated_at">): Promise<Recipe>;
  updateRecipe(id: string, patch: Partial<Recipe>): Promise<Recipe>;
  getRecipe(id: string): Promise<Recipe | null>;
  listRecipes(restaurantId: string, filter?: { productId?: string; status?: Recipe["status"] }): Promise<Recipe[]>;
  replaceItems(recipeId: string, items: RecipeItemInput[]): Promise<RecipeItem[]>;
  listItems(recipeId: string): Promise<RecipeItem[]>;
  saveVersion(v: Omit<RecipeVersionSnapshot, "id" | "created_at">): Promise<RecipeVersionSnapshot>;
  listVersions(recipeId: string): Promise<RecipeVersionSnapshot[]>;
  listIngredients(restaurantId: string): Promise<Ingredient[]>;
}

const cache = new Map<string, { at: number; recipe: Recipe; items: RecipeItem[] }>();
const TTL = 15_000;

export interface CreateRecipeDeps {
  repo: RecipeRepository;
  inventory?: InventoryService;
}

function nowIso() { return new Date().toISOString(); }

export function createRecipeService({ repo, inventory }: CreateRecipeDeps) {
  async function snapshot(recipe: Recipe, changedBy?: string, reason?: string) {
    const items = await repo.listItems(recipe.id);
    await repo.saveVersion({
      recipe_id: recipe.id,
      version: recipe.version,
      snapshot: { recipe, items },
      changed_by: changedBy ?? null,
      change_reason: reason ?? null,
    });
  }

  return {
    async list(restaurantId: string, filter?: Parameters<RecipeRepository["listRecipes"]>[1]) {
      return repo.listRecipes(restaurantId, filter);
    },
    async get(id: string) {
      const c = cache.get(id);
      if (c && Date.now() - c.at < TTL) return c;
      const recipe = await repo.getRecipe(id);
      if (!recipe) return null;
      const items = await repo.listItems(id);
      const value = { at: Date.now(), recipe, items };
      cache.set(id, value);
      return value;
    },
    async create(input: RecipeInput, opts: { performedBy?: string } = {}) {
      const ingredients = await repo.listIngredients(input.restaurant_id);
      const v = validateRecipe(input.items, ingredients);
      if (!v.valid) throw new Error(v.issues.map((i) => i.message).join("; "));
      const recipe = await repo.createRecipe({
        restaurant_id: input.restaurant_id,
        product_id: input.product_id ?? null,
        name: input.name,
        description: input.description ?? null,
        yield_quantity: input.yield_quantity ?? 1,
        yield_unit: input.yield_unit ?? "un",
        preparation_time: input.preparation_time ?? null,
        status: "DRAFT",
        version: 1,
        variation_key: input.variation_key ?? null,
        metadata: input.metadata ?? {},
      });
      await repo.replaceItems(recipe.id, input.items);
      await snapshot(recipe, opts.performedBy, "created");
      cache.delete(recipe.id);
      RecipeEventBus.emit({ name: "RecipeCreated", recipeId: recipe.id, at: nowIso() });
      return recipe;
    },
    async update(id: string, patch: Partial<RecipeInput>, opts: { performedBy?: string; reason?: string } = {}) {
      const current = await repo.getRecipe(id);
      if (!current) throw new Error("Recipe not found");
      if (patch.items) {
        const ings = await repo.listIngredients(current.restaurant_id);
        const v = validateRecipe(patch.items, ings);
        if (!v.valid) throw new Error(v.issues.map((i) => i.message).join("; "));
      }
      const nextVersion = current.version + 1;
      const updated = await repo.updateRecipe(id, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.product_id !== undefined ? { product_id: patch.product_id } : {}),
        ...(patch.yield_quantity !== undefined ? { yield_quantity: patch.yield_quantity } : {}),
        ...(patch.yield_unit !== undefined ? { yield_unit: patch.yield_unit } : {}),
        ...(patch.preparation_time !== undefined ? { preparation_time: patch.preparation_time } : {}),
        ...(patch.variation_key !== undefined ? { variation_key: patch.variation_key } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
        version: nextVersion,
      });
      if (patch.items) await repo.replaceItems(id, patch.items);
      await snapshot(updated, opts.performedBy, opts.reason ?? "updated");
      cache.delete(id);
      RecipeEventBus.emit({ name: "RecipeUpdated", recipeId: id, at: nowIso() });
      RecipeEventBus.emit({ name: "RecipeCostChanged", recipeId: id, at: nowIso() });
      return updated;
    },
    async duplicate(id: string, overrides: Partial<RecipeInput> = {}, opts: { performedBy?: string } = {}) {
      const cur = await repo.getRecipe(id);
      if (!cur) throw new Error("Recipe not found");
      const items = await repo.listItems(id);
      return this.create({
        restaurant_id: cur.restaurant_id,
        product_id: overrides.product_id ?? cur.product_id,
        name: overrides.name ?? `${cur.name} (cópia)`,
        description: overrides.description ?? cur.description,
        yield_quantity: overrides.yield_quantity ?? cur.yield_quantity,
        yield_unit: overrides.yield_unit ?? cur.yield_unit,
        preparation_time: overrides.preparation_time ?? cur.preparation_time,
        variation_key: overrides.variation_key ?? cur.variation_key,
        metadata: overrides.metadata ?? cur.metadata,
        items: overrides.items ?? items.map((i) => ({
          ingredient_id: i.ingredient_id, quantity: Number(i.quantity), unit: i.unit,
          loss_percentage: Number(i.loss_percentage), optional: i.optional,
          substitute_of: i.substitute_of, display_order: i.display_order,
        })),
      }, opts);
    },
    async setStatus(id: string, status: Recipe["status"]) {
      const updated = await repo.updateRecipe(id, { status });
      cache.delete(id);
      if (status === "ACTIVE") RecipeEventBus.emit({ name: "RecipeActivated", recipeId: id, at: nowIso() });
      if (status === "ARCHIVED") RecipeEventBus.emit({ name: "RecipeArchived", recipeId: id, at: nowIso() });
      return updated;
    },
    async versions(id: string) { return repo.listVersions(id); },
    async cost(id: string, price = 0) {
      const c = await this.get(id);
      if (!c) throw new Error("Recipe not found");
      const ings = await repo.listIngredients(c.recipe.restaurant_id);
      return RecipeCostEngine.compute(c.recipe, c.items, ings, price);
    },
    /** Consume ingredients via InventoryService when an order is completed. */
    async consumeForOrder(id: string, opts: { multiplier?: number; orderId?: string; performedBy?: string } = {}) {
      if (!inventory) throw new Error("InventoryService not wired");
      const c = await this.get(id);
      if (!c) throw new Error("Recipe not found");
      const mult = opts.multiplier ?? 1;
      for (const it of c.items) {
        if (it.optional) continue;
        const q = Number(it.quantity) * mult;
        const loss = Number(it.loss_percentage ?? 0) / 100;
        const effective = loss > 0 && loss < 1 ? q / (1 - loss) : q;
        await inventory.decreaseStock({
          ingredientId: it.ingredient_id,
          quantity: effective,
          referenceType: "recipe",
          referenceId: opts.orderId,
          performedBy: opts.performedBy,
          metadata: { recipe_id: id },
        }, "PRODUCTION");
      }
    },
    invalidateCache(id?: string) {
      if (id) cache.delete(id); else cache.clear();
    },
  };
}

export type RecipeService = ReturnType<typeof createRecipeService>;
