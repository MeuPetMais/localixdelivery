# Loyalty & Rewards Engine (Prompt 13.6.2)

Configurable loyalty program per restaurant. Owner defines levels + rules;
customers earn points/cashback from orders and redeem rewards.

## Files

| File | Responsibility |
|---|---|
| `types.ts` | `CustomerLoyalty`, `LoyaltyTransaction`, `LoyaltyLevel`, `LoyaltyRule`, `Reward`, `LoyaltyContext`. |
| `LoyaltyService.ts` | Facade: accrue, redeem points/cashback/rewards, expire, adjust. |
| `LoyaltyRuleEngine.ts` | **Pure**. Evaluates configurable rules against an order context. |
| `LevelResolver.ts` | **Pure**. Resolves current level from lifetime points. |
| `RewardService.ts` | **Pure**. Validates whether a reward can be redeemed. |
| `LoyaltyEventBus.ts` | `PointsEarned`, `PointsRedeemed`, `PointsExpired`, `CashbackEarned`, `CashbackRedeemed`, `LevelChanged`, `RewardUnlocked`. |
| `index.ts` | Barrel. |
| `LoyaltyEngine.test.ts` | 22 tests covering rules, levels, rewards, events. |

## Tables (new)

- `customer_loyalty` — one row per (customer, restaurant): points/cashback balances, lifetime totals, level, status. CHECK constraints prevent negative balances.
- `loyalty_transactions` — immutable ledger for every earn/redeem/expire/adjust.
- `loyalty_levels` — configurable per restaurant (Bronze/Silver/Gold/Diamond or custom).
- `loyalty_rules` — configurable per restaurant: `POINTS_PER_ORDER`, `POINTS_PER_AMOUNT`, `POINTS_PER_CATEGORY`, `POINTS_PER_PRODUCT`, `CASHBACK_PERCENT`, `FIRST_PURCHASE_BONUS`, `BIRTHDAY_BONUS`, `SPECIAL_DATE`.

RLS: customer sees only own balance/tx; owner sees only own restaurant's tx/levels/rules. Multi-tenant strict, no cross-tenant access.

## Reused (not duplicated)

- `customer_points` (legacy per-customer balance) — kept for backward compat; `customer_loyalty` is the multi-tenant successor.
- `CustomerTimeline` — every accrual writes a timeline event.
- `coupons` (Product/Pricing) — reward redemption can attach an existing coupon.
- `business/rules/cashback-rules.ts` — high-level eligibility gates already consumed by BusinessRulesEngine.

## Integrations

- **Order Domain** — call `LoyaltyService.accrueFromOrder(ctx)` from `OrderOrchestrator` when the order transitions to `entregue`. Idempotency lives at the call site (check `loyalty_transactions.reference_id`).
- **Dynamic Pricing** — `RewardService.canRedeem` gates checkout-time redemption; the resulting delta feeds `DynamicPricingService` as an extra discount input.
- **NotificationCenter** — subscribe to `LoyaltyEventBus` and translate events (`PointsEarned`, `LevelChanged`, `CashbackEarned`, `RewardUnlocked`) into notifications honoring `customer_preferences` opt-ins.
- **Customer Timeline** — recorded on every accrual/redemption.

## Not touched

Customer Foundation, Product Domain, Dynamic Pricing, Checkout, OrderOrchestrator, BusinessRulesEngine, NotificationCenter, PricingEngine, Finance Domain, Inventory Domain.

## Pending for 13.6.3

- `CustomerSegmentationService` (VIP / frequent / inactive / new) persisted.
- Wire `accrueFromOrder` into `OrderOrchestrator.onDelivered` with idempotency guard.
- NotificationCenter listeners for the six loyalty events.
- Dashboard widgets (balances, level distribution, top redemptions, campaigns).
- Cron job for time-based point expiration.
- Cross-tenant merge of `customers` (phone-keyed) ↔ `customer_profiles` (auth-keyed).
