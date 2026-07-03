import { describe, expect, it, beforeEach } from "vitest";
import { LoyaltyRuleEngine } from "./LoyaltyRuleEngine";
import { LevelResolver } from "./LevelResolver";
import { RewardService } from "./RewardService";
import { LoyaltyEventBus, type LoyaltyDomainEvent } from "./LoyaltyEventBus";
import type { LoyaltyLevel, LoyaltyRule, LoyaltyContext } from "./types";

const rule = (overrides: Partial<LoyaltyRule>): LoyaltyRule => ({
  id: "r1", restaurant_id: "rest", name: "r", rule_type: "POINTS_PER_ORDER",
  config: {}, active: true, priority: 100, ...overrides,
});

const ctx: LoyaltyContext = {
  customer_id: "u1", restaurant_id: "rest", order_id: "o1", order_total: 100,
  items: [
    { product_id: "p1", category_id: "c1", qty: 2, price: 30 },
    { product_id: "p2", category_id: "c2", qty: 1, price: 40 },
  ],
};

describe("LoyaltyRuleEngine", () => {
  it("POINTS_PER_ORDER", () => {
    const r = LoyaltyRuleEngine.computeRule(rule({ rule_type: "POINTS_PER_ORDER", config: { points: 10 } }), ctx);
    expect(r).toEqual({ points: 10, cashback: 0 });
  });
  it("POINTS_PER_AMOUNT: 1 pt per R$10", () => {
    const r = LoyaltyRuleEngine.computeRule(rule({ rule_type: "POINTS_PER_AMOUNT", config: { per_amount: 10, points: 1 } }), ctx);
    expect(r.points).toBe(10);
  });
  it("POINTS_PER_CATEGORY only counts matching category", () => {
    const r = LoyaltyRuleEngine.computeRule(rule({ rule_type: "POINTS_PER_CATEGORY", config: { category_id: "c1", points: 5 } }), ctx);
    expect(r.points).toBe(10);
  });
  it("POINTS_PER_PRODUCT only counts matching product", () => {
    const r = LoyaltyRuleEngine.computeRule(rule({ rule_type: "POINTS_PER_PRODUCT", config: { product_id: "p2", points: 3 } }), ctx);
    expect(r.points).toBe(3);
  });
  it("CASHBACK_PERCENT respects cap", () => {
    const r = LoyaltyRuleEngine.computeRule(rule({ rule_type: "CASHBACK_PERCENT", config: { percent: 10, max_cashback: 5 } }), ctx);
    expect(r.cashback).toBe(5);
  });
  it("FIRST_PURCHASE_BONUS only on first purchase", () => {
    const r1 = LoyaltyRuleEngine.computeRule(rule({ rule_type: "FIRST_PURCHASE_BONUS", config: { points: 100 } }), { ...ctx, is_first_purchase: true });
    const r2 = LoyaltyRuleEngine.computeRule(rule({ rule_type: "FIRST_PURCHASE_BONUS", config: { points: 100 } }), { ...ctx, is_first_purchase: false });
    expect(r1.points).toBe(100);
    expect(r2.points).toBe(0);
  });
  it("respects min_order gate", () => {
    const r = LoyaltyRuleEngine.computeRule(rule({ rule_type: "POINTS_PER_ORDER", config: { points: 10 }, min_order: 200 }), ctx);
    expect(r.points).toBe(0);
  });
  it("respects date window", () => {
    const r = LoyaltyRuleEngine.computeRule(
      rule({ rule_type: "POINTS_PER_ORDER", config: { points: 10 }, starts_at: "2999-01-01T00:00:00Z" }),
      ctx,
    );
    expect(r.points).toBe(0);
  });
  it("compute aggregates multiple rules", () => {
    const result = LoyaltyRuleEngine.compute([
      rule({ id: "a", rule_type: "POINTS_PER_ORDER", config: { points: 5 } }),
      rule({ id: "b", rule_type: "CASHBACK_PERCENT", config: { percent: 2 } }),
    ], ctx);
    expect(result.points).toBe(5);
    expect(result.cashback).toBe(2);
    expect(result.applied_rules).toHaveLength(2);
  });
});

describe("LevelResolver", () => {
  const levels: LoyaltyLevel[] = [
    { id: "l1", restaurant_id: "r", name: "BRONZE", minimum_points: 0, benefits: {}, display_order: 0, active: true },
    { id: "l2", restaurant_id: "r", name: "SILVER", minimum_points: 500, benefits: {}, display_order: 1, active: true },
    { id: "l3", restaurant_id: "r", name: "GOLD", minimum_points: 2000, benefits: {}, display_order: 2, active: true },
  ];
  it("resolves the highest qualifying level", () => {
    expect(LevelResolver.resolve(0, levels)).toBe("BRONZE");
    expect(LevelResolver.resolve(500, levels)).toBe("SILVER");
    expect(LevelResolver.resolve(3000, levels)).toBe("GOLD");
  });
  it("detects level ups", () => {
    expect(LevelResolver.didLevelUp(100, 600, levels)).toBe(true);
    expect(LevelResolver.didLevelUp(100, 200, levels)).toBe(false);
  });
});

describe("RewardService", () => {
  const bal = { points_balance: 100, cashback_balance: 5 };
  it("accepts valid points redemption", () => {
    expect(RewardService.canRedeem({ type: "DISCOUNT", points_cost: 50 }, bal)).toEqual({ ok: true });
  });
  it("rejects insufficient points", () => {
    expect(RewardService.canRedeem({ type: "DISCOUNT", points_cost: 200 }, bal)).toEqual({ ok: false, reason: "insufficient_points" });
  });
  it("rejects insufficient cashback", () => {
    expect(RewardService.canRedeem({ type: "CASHBACK", cashback_cost: 20 }, bal)).toEqual({ ok: false, reason: "insufficient_cashback" });
  });
  it("rejects zero-cost reward", () => {
    expect(RewardService.canRedeem({ type: "FREE_PRODUCT" }, bal)).toEqual({ ok: false, reason: "invalid_cost" });
  });
  it("applyDeltas returns negative deltas", () => {
    expect(RewardService.applyDeltas({ type: "DISCOUNT", points_cost: 50, cashback_cost: 2 }))
      .toEqual({ points_delta: -50, cashback_delta: -2 });
  });
});

describe("LoyaltyEventBus", () => {
  beforeEach(() => LoyaltyEventBus.clear());
  it("delivers events", async () => {
    const seen: LoyaltyDomainEvent[] = [];
    LoyaltyEventBus.subscribe((e) => { seen.push(e); });
    await LoyaltyEventBus.publish({ type: "PointsEarned", customerId: "u1", restaurantId: "r", points: 10, at: "now" });
    expect(seen[0]?.type).toBe("PointsEarned");
  });
});
