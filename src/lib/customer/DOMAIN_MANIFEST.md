# Customer DOMAIN_MANIFEST

Status: **Foundation (13.6.1) implemented** — 2026-07-03.

## Layer map

```
src/lib/customer/
├── types.ts
├── CustomerService.ts            # facade
├── CustomerAddressService.ts     # reuses customer-addresses.ts
├── CustomerPreferencesService.ts # customer_preferences
├── CustomerFavoritesService.ts   # customer_favorites
├── CustomerTimeline.ts           # customer_timeline
├── CustomerValidator.ts          # pure
├── CustomerAudit.ts              # in-memory
├── CustomerEventBus.ts           # in-process
├── index.ts
├── CustomerFoundation.test.ts
├── CustomerFoundation.README.md
└── DOMAIN_MANIFEST.md
```

## Tables owned

- `customer_profiles` (existing)
- `customer_addresses` (existing)
- `customer_favorites` (existing)
- `customer_points` (existing)
- `customer_notifications` (existing)
- `customer_timeline` (new — 13.6.1)
- `customer_preferences` (new — 13.6.1)
- `customer_consents` (new — 13.6.1, LGPD)

## Events

`CustomerCreated`, `CustomerUpdated`, `AddressAdded`, `AddressChanged`,
`PreferenceChanged`, `FavoriteAdded`, `FavoriteRemoved`, `ConsentUpdated`,
`TimelineEventCreated`.

## Dependencies (allowed)

- Read-only: `orders` (order history), `reviews`.
- Reuses: business rules in `src/lib/business/rules/customer-rules.ts`,
  `cashback-rules.ts`, `coupon-rules.ts`.

## Forbidden

Authentication, Authorization, OrderOrchestrator, NotificationCenter,
BusinessRulesEngine internals, Product/Finance/Inventory/Tenant domains.
