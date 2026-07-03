# Production Engine

Manages production orders (planning, execution, losses, batches). Every
stock change is delegated to `InventoryService` — production code never
writes to `ingredients.stock` directly.

## Flow

```
Recipe (ACTIVE)
  ↓
ProductionPlanner  → validates + reserves ingredients (InventoryService.reserveStock)
  ↓
Production Order (PLANNED)
  ↓  start()
IN_PROGRESS  ─── pause() ⇄ start() ── cancel() → CANCELLED
  ↓  complete()
- releaseStock(planned) + decreaseStock(actual, PRODUCTION)
- recordConsumption / recordOutput
- recordLoss + decreaseStock(LOSS)
- optional Batch
  ↓
COMPLETED
```

## Status

`PLANNED · IN_PROGRESS · PAUSED · COMPLETED · CANCELLED · FAILED`

Batches: `ACTIVE · CONSUMED · EXPIRED · DISCARDED`

## Files (`src/lib/production/`)

- `types.ts`
- `ProductionService.ts` — plan / start / pause / cancel / fail / complete / registerLoss
- `ProductionValidator.ts` — recipe active, active ingredients, available stock (stock − reserved)
- `ProductionYieldEngine.ts` — planned vs actual, efficiency %
- `ProductionLossEngine.ts` — normalizes losses + computes cost
- `ProductionEventBus.ts` — ProductionPlanned/Started/Paused/Resumed/Completed/Cancelled/Failed, BatchCreated, BatchExpired, LossRegistered
- `ProductionAudit.ts` — in-memory audit trail
- `index.ts`
- `ProductionEngine.test.ts` — 11 tests

## Tables

- `production_orders` — status, planned/produced quantity, timestamps, expiration
- `production_consumption` — planned vs consumed vs loss per ingredient
- `production_output` — produced / approved / rejected per product
- `production_losses` — quantity, reason, cost
- `production_batches` — batch_code, manufacturing/expiration, status

Enums: `production_order_status`, `production_batch_status`. RLS scoped to
`restaurants.owner_id = auth.uid()`.

## Use cases supported

- **Pré-preparo** — plan batches of Massa/Molho/Hambúrguer ahead of demand.
- **Sob demanda** — `planned_quantity = 1`, complete immediately.
- **Lote** — high `planned_quantity` + `batchCode` + `expirationDate`.
- **Transformação** — recipe with `yield_quantity` > input (10 kg farinha → 50 massas).

## Integration

- **RecipeService** — `recipes.get(id)` loads active recipe + items and versions.
- **InventoryService** — `reserveStock` on plan, `releaseStock` + `decreaseStock(PRODUCTION)` on complete, `decreaseStock(LOSS)` on loss, `releaseStock` on cancel.
- **BusinessRulesEngine** (opcional) — chame o motor de regras antes de `plan()` para validar horário/capacidade; nenhum acoplamento aqui.

## Testing

`bunx vitest run src/lib/production/ProductionEngine.test.ts` — 11 tests
covering validation, planning, full lifecycle, cancel-releases, losses,
batches, transformation, yield efficiency, events and audit.

## Not modified

Inventory Foundation, InventoryService, RecipeService/Domain,
OrderOrchestrator, BusinessRulesEngine, PricingEngine, Checkout,
FinancialLedger, EventBus.

## Pending for production

- Supabase-backed `ProductionRepository` adapter.
- Scheduler that flips expired batches to `EXPIRED` and emits `BatchExpired`.
- Production Dashboard + Timeline UI (widgets exist as stubs).
- Wire `BusinessRulesEngine` guards (open hours, capacity) before `plan()`.
