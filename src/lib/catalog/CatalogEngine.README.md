# Catalog Engine

Reusable catalog layer sitting on top of the **Product Foundation**. Enables
multiple menus per restaurant, per channel (delivery, pickup, dine-in, QR,
totem, marketplace, API), without touching product source-of-truth (`menu_items`).

## Layers

```
Product Domain
   ↓
CatalogService  →  Menus  →  Availability  →  Ordering  →  Presentation
   ↓
Categories / Products (references, not copies)
```

## Tables

| Table | Purpose |
| --- | --- |
| `catalog_menus` | One row per menu (name, channel, status, weekday/time window) |
| `catalog_menu_categories` | Join between a menu and existing `menu_categories` |
| `catalog_menu_products` | Join between a menu and existing `menu_items`, with `is_featured` |
| `catalog_events` | Internal audit trail of catalog operations |

All tables are owner-scoped RLS via `restaurants.owner_id`. Never
cross-tenant. Reuses `menu_categories` and `menu_items` — no duplication.

## Services

- **CatalogService** (`CatalogService.functions.ts`): create/update menus,
  attach/detach categories & products, transitions.
- **CategoryService / MenuService**: expressed as the join operations
  (`attachCategory`, `attachProduct`, `listMenuCategories`, `listMenuProducts`).
- **CatalogAvailabilityService**: pure resolver — is this menu servable now?
- **OrderingService**: manual / best_sellers / most_profitable / recent / ai.
- **FeaturedProducts**: `featureProduct()` toggles `is_featured` on the join.
- **ProductVisibilityService**: channel-based visibility (delivery/pickup/dine-in/qr/totem/marketplace/api).
- **CatalogSearchService**: in-memory search (name, category, tag, ingredient, SKU).
- **CatalogValidator**: input + status-transition guard.
- **CatalogEventBus**: `CatalogCreated`, `CatalogUpdated`, `MenuCreated`,
  `MenuPublished`, `MenuArchived`, `MenuStatusChanged`, `CategoryCreated`,
  `CategoryRemoved`, `ProductAttached`, `ProductDetached`, `ProductFeatured`.

## Integrations

- **Product Foundation**: reads existing product records (never mutates).
- **Inventory Domain**: `stockAvailable` is a signal fed into
  `CatalogAvailabilityService` (Inventory owns the source of truth).
- **BusinessRulesEngine**: can subscribe to `CatalogEventBus` to react to
  publish/archive.
- **TenantConfigurationService**: reads restaurant scope for channel defaults.

## Status transitions

```
draft ↔ scheduled → published ↔ archived → draft
```

## Testing

`CatalogEngine.test.ts` covers validator, availability, ordering, visibility,
search, and event bus. Server functions are integration-tested via preview.

## Pending (13.5.3)

- Server-side full-text search (`tsvector`).
- Menu scheduling worker (auto `scheduled → published`).
- QR-code deep links per menu.
- Dashboard widgets (Menus, Featured, Hidden, Unavailable).
- AI ordering signal producer.
