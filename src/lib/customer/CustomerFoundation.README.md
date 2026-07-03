# Customer Foundation (Prompt 13.6.1)

Domain foundation for the Customer CRM. Isolated in `src/lib/customer/` and
composed of pure Services + EventBus + Validator + Audit — following the same
pattern used by `src/lib/product/`, `src/lib/recipes/` and `src/lib/catalog/`.

## Files

| File | Responsibility |
|---|---|
| `types.ts` | Shared types (`CustomerProfile`, `CustomerPreferences`, `CustomerConsent`, `CustomerTimelineEvent`). |
| `CustomerService.ts` | Public facade — profile, consents, order history, and sub-services. |
| `CustomerAddressService.ts` | Thin wrapper over existing `customer-addresses.ts` + event emission. |
| `CustomerPreferencesService.ts` | CRUD for `customer_preferences` with sane defaults. |
| `CustomerFavoritesService.ts` | CRUD for `customer_favorites` (product / category / restaurant). |
| `CustomerTimeline.ts` | `customer_timeline` reader/writer + `TimelineEventCreated` event. |
| `CustomerValidator.ts` | Pure validation for profile / address / preferences. |
| `CustomerAudit.ts` | In-memory audit log (persistence lives in `customer_timeline` + `customer_consents`). |
| `CustomerEventBus.ts` | In-process bus: `CustomerCreated`, `CustomerUpdated`, `AddressAdded`, `AddressChanged`, `PreferenceChanged`, `FavoriteAdded`, `FavoriteRemoved`, `ConsentUpdated`, `TimelineEventCreated`. |
| `index.ts` | Barrel export. |
| `CustomerFoundation.test.ts` | Vitest suite for pure logic (validator, event bus, audit). |

## New tables

- `customer_timeline` — event log per customer (typed `event_type`).
- `customer_preferences` — payment/channel/category, dietary restrictions,
  language, marketing/push/email/whatsapp opt-ins.
- `customer_consents` — LGPD trail (type, granted, source, IP, user agent).

All three enable RLS scoped to `auth.uid() = customer_id`.

## Reused (not duplicated)

- `customer_profiles`, `customer_addresses`, `customer_favorites`,
  `customer_points`, `customer_notifications`, `reviews`, `coupons`.
- `src/lib/customer-addresses.ts`, `src/lib/favorites.ts`,
  `src/lib/profile-completion.ts`, `src/lib/customer-notify.ts`.
- `src/hooks/use-customer-auth.ts`, `src/contexts/CustomerNotificationsContext.tsx`.
- `src/lib/business/rules/customer-rules.ts`, `cashback-rules.ts`, `coupon-rules.ts`.

## Integrations

- **Order Domain** — `CustomerService.listOrders(customerId)` reads
  `orders` scoped by RLS (`customer_id = auth.uid()`).
- **NotificationCenter** — `customer_preferences.{push,email,whatsapp}_opt_in`
  is the source of truth for delivery channels.
- **BusinessRulesEngine** — existing `CUSTOMER_*` rules already consume the
  same profile shape.

## Not touched

Authentication, Authorization, OrderOrchestrator, NotificationCenter,
BusinessRulesEngine, Product Domain, Finance Domain, Inventory Domain,
TenantConfigurationService.

## Pending for 13.6.2

- `LoyaltyEngine` (points accrual/redemption/expiration) reusing
  `customer_points` + `coupons`.
- `CustomerSegmentationService` (VIP / frequent / inactive / new) persisted.
- Merge/reconciliation between `customers` (per-restaurant, phone-keyed) and
  `customer_profiles` (global, auth-keyed).
- LGPD export + anonymization flow leveraging `customer_consents`.
- Harden `lookupCustomerArea` (auth/OTP).
- Restaurant Dashboard widgets (active / new / inactive / recurring).
