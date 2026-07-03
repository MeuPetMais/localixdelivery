# Recipe Domain (Product BOM)

Bill-of-materials layer over the Inventory Foundation. Products (menu items)
are linked to Recipes; Recipes have Items pointing to Ingredients. All stock
movement goes through `InventoryService.decreaseStock(..., "PRODUCTION")`.

## Architecture

```
Product (menu_items)
  ↓
Recipe (product_recipes)
  ↓
Recipe Items (product_recipe_items)
  ↓
Ingredients
  ↓
InventoryService
```

## Files

- `types.ts` — Recipe, RecipeItem, RecipeInput, RecipeStatus, RecipeEvent
- `RecipeService.ts` — CRUD + duplicate + versioning + cost + consume
- `RecipeValidator.ts` — empty / duplicate / missing / negative / loss checks
- `RecipeCostEngine.ts` — total cost, cost/portion, margin, gross profit
- `RecipeYieldEngine.ts` — effective quantity with loss %, utilization
- `RecipeSimulation.ts` — production simulator (bottleneck, stock impact)
- `RecipeEventBus.ts` — RecipeCreated / Updated / Activated / Archived / CostChanged
- `index.ts`
- `RecipeDomain.test.ts` — 10 test cases

## Database

Migration creates:

- `product_recipes` — id, restaurant_id, product_id (menu_items), name,
  description, yield_quantity/unit, preparation_time, status, version,
  variation_key, metadata
- `product_recipe_items` — recipe_id, ingredient_id, quantity, unit,
  loss_percentage, optional, substitute_of (self-FK), display_order
- `product_recipe_versions` — immutable JSONB snapshot per version

RLS scoped to `restaurants.owner_id = auth.uid()`. Version rows are
insert/select-only for owners; there is no UPDATE/DELETE grant.

## Status lifecycle

`DRAFT → ACTIVE → ARCHIVED` — set via `setStatus`.

## Versioning

Every `create` and `update` writes a full snapshot to
`product_recipe_versions`. `update` also bumps `version`.

## Variations, add-ons and combos

- **Variations** — one Recipe per size (Pizza P/M/G) using `variation_key`.
- **Add-ons** — separate Recipes for optional add-ons (Bacon, Catupiry…);
  they consume their own ingredients.
- **Combos** — the combo Product resolves to N child Recipes (Pizza + Soda
  + Dessert). Each is consumed via `consumeForOrder` at completion.

## Integration with InventoryService

`RecipeService.consumeForOrder(id, { multiplier, orderId, performedBy })`
iterates items (skips optional), applies `loss_percentage` and calls
`InventoryService.decreaseStock(..., "PRODUCTION")`. Orders never touch
stock directly — call this from OrderOrchestrator's completion listener.

## Cache

`RecipeService.get(id)` caches recipe + items for 15s. Any `update` /
`setStatus` invalidates.

## Testing

`bunx vitest run src/lib/recipes/RecipeDomain.test.ts` — 10 cases:
create, edit + versioning, cost + margin, invalid recipes, variations,
duplicate, optional items, InventoryService consumption, production
simulation, event bus.

## Not modified

Inventory Foundation, InventoryService, OrderOrchestrator,
BusinessRulesEngine, PricingEngine, ProductService, Checkout,
FinancialLedger, EventBus.

## Pending for production

- Supabase-backed `RecipeRepository` adapter (tests use in-memory).
- Wire OrderOrchestrator `OrderCompleted` listener → `consumeForOrder`.
- UI: RecipePreview + RecipeSimulation panels + version history viewer.
- Register a `RecipeWidget` in `WidgetRegistry`.
