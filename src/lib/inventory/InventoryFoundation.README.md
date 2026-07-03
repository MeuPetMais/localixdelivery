# Inventory Foundation

The Inventory Domain is an ERP-style module that centralizes every stock
movement in Localix. External code never mutates stock directly — all
changes go through `InventoryService` (or the higher-level
`PurchaseOrderService` / `ProductRecipeService` / `StockMovementService`
facades), which validate, persist, audit and publish domain events.

## Architecture

```
src/lib/inventory/
├── types.ts                    # Domain types + enums
├── InventoryValidator.ts       # Business validations (stock, active, reserves)
├── InventoryEventBus.ts        # StockReserved / StockLow / StockOut / ...
├── InventoryAudit.ts           # In-memory audit trail (who / when / source)
├── StockAlerts.ts              # LOW / OUT / REORDER classification
├── CostEngine.ts               # Recipe + stock cost math
├── MarginEngine.ts             # Margin, markup, suggested price
├── InventoryService.ts         # Core: reserve/release/decrease/increase/adjust/transfer
├── IngredientService.ts        # CRUD facade for ingredients
├── SupplierService.ts          # CRUD facade for suppliers
├── PurchaseOrderService.ts     # Draft → Receive (feeds InventoryService)
├── ProductRecipeService.ts     # Recipe cost + production consumption
├── StockMovementService.ts     # Router by MovementType
└── InventoryFoundation.test.ts # 12 test cases (entry/exit/reserve/transfer/adjust/PO/alerts)
```

## Database

Migration adds:

- `inventory_locations` — restaurant-scoped stock locations.
- `stock_movements` — every change (ENTRY, EXIT, RESERVE, RELEASE, LOSS,
  ADJUSTMENT, TRANSFER, PRODUCTION, SALE) with previous/new balance,
  reason, reference (order/purchase_order/manual), performer and metadata.
- `purchase_order_items` — line items with quantity/unit price/total.
- Extends `ingredients` with `sku`, `barcode`, `active`, `reserved_stock`,
  `supplier_id`. Legacy fields (`stock`, `min_stock`, `unit_cost`)
  preserved — the existing `inventory.tsx` page keeps working untouched.
- Extends `suppliers` with `restaurant_id`, `contact_name`, `document`,
  `address`, `status`.
- Extends `purchase_orders` with `restaurant_id`, `status`
  (`purchase_order_status` enum), `expected_date`, `total_cost`, `notes`,
  `updated_at`. Legacy single-item columns preserved for compatibility.

## Security

- RLS enabled on every new/extended inventory table.
- Owners manage rows only for restaurants they own; `service_role` has
  full access for edge/admin flows.
- All state mutations MUST go through `InventoryService`; direct
  `supabase.update()` on `ingredients.stock` from feature code is
  forbidden (existing legacy code paths remain, but any new movement code
  must adopt the service).

## Events

`InventoryEventBus.on("StockLow" | "StockOut" | "StockReserved" | ...)`
lets other modules react (e.g. NotificationCenter for low-stock alerts,
BusinessRulesEngine for auto-reorder).

## Cache & performance

- `InventoryService.listIngredients` caches per restaurant for 15 s and
  invalidates on every mutation.
- `stock_movements` indexed by `(ingredient_id, created_at DESC)` for
  fast paginated history queries.

## Tests

Run: `bunx vitest run src/lib/inventory/InventoryFoundation.test.ts`

12 cases covering: entry, exit, over-exit rejection, reserve/release,
adjust, transfer, StockLow + StockOut events, audit trail,
StockAlerts classification, CostEngine.recipeCost, MarginEngine,
PurchaseOrder draft → receive.

## Extending

- **New movement type** — add to the `MovementType` union + `stock_movement_type` enum + a route in `StockMovementService.record`.
- **New provider** — implement `InventoryRepository` and pass it to `createInventoryService(repo)`.
- **Disable a rule** — subscribe to `InventoryEventBus` and no-op, or
  wrap the service call.

## Not modified

OAuth, PaymentService, PricingEngine, Checkout, PaymentIntent,
WebhookService, FinancialLedger, ReconciliationService, SplitService,
OrderOrchestrator, BusinessRulesEngine, NotificationCenter,
DeliveryEngine, TenantConfigurationService, RestaurantDashboard.
The existing `/inventory` route (`src/routes/_authenticated/inventory.tsx`)
is untouched and continues to read/write the same columns.

## Pending for production

- Supabase-backed repository adapter (current tests use in-memory).
- Persist `InventoryAudit` to a dedicated table.
- Migrate legacy `purchase_orders` single-item rows into
  `purchase_order_items`.
- Register `InventoryWidget` in `WidgetRegistry` and wire alerts into
  `NotificationCenter`.
