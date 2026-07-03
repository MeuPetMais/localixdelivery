import { supabase } from "@/integrations/supabase/client";
import { CustomerTimeline } from "../CustomerTimeline";
import { LoyaltyEventBus } from "./LoyaltyEventBus";
import { LoyaltyRuleEngine } from "./LoyaltyRuleEngine";
import { LevelResolver } from "./LevelResolver";
import { RewardService } from "./RewardService";
import type {
  CustomerLoyalty, LoyaltyAccrual, LoyaltyContext, LoyaltyLevel, LoyaltyRule,
  LoyaltyTransaction, LoyaltyTransactionType, Reward,
} from "./types";

const L = () => (supabase as any).from("customer_loyalty");
const TX = () => (supabase as any).from("loyalty_transactions");
const LV = () => (supabase as any).from("loyalty_levels");
const RL = () => (supabase as any).from("loyalty_rules");

async function ensureBalance(customerId: string, restaurantId: string): Promise<CustomerLoyalty> {
  const { data } = await L().select("*").eq("customer_id", customerId).eq("restaurant_id", restaurantId).maybeSingle();
  if (data) return data as CustomerLoyalty;
  const { data: created, error } = await L().insert({
    customer_id: customerId, restaurant_id: restaurantId,
  }).select().maybeSingle();
  if (error) throw error;
  return created as CustomerLoyalty;
}

async function insertTransaction(input: {
  customer_id: string; restaurant_id: string; transaction_type: LoyaltyTransactionType;
  points?: number; cashback?: number; reference_type?: string; reference_id?: string;
  description?: string; metadata?: Record<string, unknown>;
}): Promise<LoyaltyTransaction> {
  const { data, error } = await TX().insert({
    points: 0, cashback: 0, metadata: {}, ...input,
  }).select().maybeSingle();
  if (error) throw error;
  return data as LoyaltyTransaction;
}

async function applyDelta(current: CustomerLoyalty, deltaPoints: number, deltaCashback: number,
  lifetimePoints = 0, lifetimeCashback = 0): Promise<CustomerLoyalty> {
  const nextPoints = current.points_balance + deltaPoints;
  const nextCashback = Math.round((current.cashback_balance + deltaCashback) * 100) / 100;
  if (nextPoints < 0) throw new Error("Loyalty: negative points not allowed");
  if (nextCashback < 0) throw new Error("Loyalty: negative cashback not allowed");
  const { data, error } = await L().update({
    points_balance: nextPoints,
    cashback_balance: nextCashback,
    lifetime_points: current.lifetime_points + Math.max(0, lifetimePoints),
    lifetime_cashback: Math.round((current.lifetime_cashback + Math.max(0, lifetimeCashback)) * 100) / 100,
  }).eq("id", current.id).select().maybeSingle();
  if (error) throw error;
  return data as CustomerLoyalty;
}

/**
 * LoyaltyService — facade for Points, Cashback, Levels and Rewards.
 * Reuses CustomerTimeline for auditing and emits domain events.
 */
export const LoyaltyService = {
  ruleEngine: LoyaltyRuleEngine,
  levelResolver: LevelResolver,
  rewards: RewardService,

  async getBalance(customerId: string, restaurantId: string) {
    return ensureBalance(customerId, restaurantId);
  },

  async listLevels(restaurantId: string): Promise<LoyaltyLevel[]> {
    const { data, error } = await LV().select("*").eq("restaurant_id", restaurantId)
      .eq("active", true).order("display_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as LoyaltyLevel[];
  },

  async listRules(restaurantId: string): Promise<LoyaltyRule[]> {
    const { data, error } = await RL().select("*").eq("restaurant_id", restaurantId)
      .eq("active", true).order("priority", { ascending: true });
    if (error) throw error;
    return (data ?? []) as LoyaltyRule[];
  },

  async listTransactions(customerId: string, restaurantId: string, limit = 50): Promise<LoyaltyTransaction[]> {
    const { data, error } = await TX().select("*")
      .eq("customer_id", customerId).eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as LoyaltyTransaction[];
  },

  /** Accrue points/cashback for a completed order. Idempotent per order_id via reference lookup at call site. */
  async accrueFromOrder(ctx: LoyaltyContext): Promise<LoyaltyAccrual & { balance: CustomerLoyalty }> {
    const [levels, rules, balance] = await Promise.all([
      LoyaltyService.listLevels(ctx.restaurant_id),
      LoyaltyService.listRules(ctx.restaurant_id),
      ensureBalance(ctx.customer_id, ctx.restaurant_id),
    ]);
    const accrual = LoyaltyRuleEngine.compute(rules, ctx);
    let next = balance;

    if (accrual.points > 0) {
      await insertTransaction({
        customer_id: ctx.customer_id, restaurant_id: ctx.restaurant_id,
        transaction_type: "POINTS_EARNED", points: accrual.points,
        reference_type: "order", reference_id: ctx.order_id,
        description: `Pontos por pedido`, metadata: { applied_rules: accrual.applied_rules },
      });
      next = await applyDelta(next, accrual.points, 0, accrual.points, 0);
      await LoyaltyEventBus.publish({
        type: "PointsEarned", customerId: ctx.customer_id, restaurantId: ctx.restaurant_id,
        points: accrual.points, orderId: ctx.order_id, at: new Date().toISOString(),
      });
    }

    if (accrual.cashback > 0) {
      await insertTransaction({
        customer_id: ctx.customer_id, restaurant_id: ctx.restaurant_id,
        transaction_type: "CASHBACK_EARNED", cashback: accrual.cashback,
        reference_type: "order", reference_id: ctx.order_id,
        description: `Cashback por pedido`, metadata: { applied_rules: accrual.applied_rules },
      });
      next = await applyDelta(next, 0, accrual.cashback, 0, accrual.cashback);
      await LoyaltyEventBus.publish({
        type: "CashbackEarned", customerId: ctx.customer_id, restaurantId: ctx.restaurant_id,
        amount: accrual.cashback, orderId: ctx.order_id, at: new Date().toISOString(),
      });
    }

    // Level transition
    const prevLevel = LevelResolver.resolve(balance.lifetime_points, levels);
    const nextLevel = LevelResolver.resolve(next.lifetime_points, levels);
    if (prevLevel !== nextLevel) {
      await L().update({ level: nextLevel }).eq("id", next.id);
      next = { ...next, level: nextLevel };
      await LoyaltyEventBus.publish({
        type: "LevelChanged", customerId: ctx.customer_id, restaurantId: ctx.restaurant_id,
        from: prevLevel, to: nextLevel, at: new Date().toISOString(),
      });
    }

    // Timeline
    if (accrual.points > 0) {
      await CustomerTimeline.record({
        customer_id: ctx.customer_id, restaurant_id: ctx.restaurant_id,
        event_type: "CASHBACK_EARNED", reference_type: "order", reference_id: ctx.order_id ?? null,
        description: `+${accrual.points} pts`, metadata: { points: accrual.points, cashback: accrual.cashback },
      }).catch(() => null);
    }

    return { ...accrual, balance: next };
  },

  async redeemPoints(customerId: string, restaurantId: string, points: number, opts?: { reference_type?: string; reference_id?: string; description?: string }) {
    if (points <= 0) throw new Error("points must be > 0");
    const current = await ensureBalance(customerId, restaurantId);
    if (current.points_balance < points) throw new Error("Insufficient points");
    await insertTransaction({
      customer_id: customerId, restaurant_id: restaurantId,
      transaction_type: "POINTS_REDEEMED", points: -points,
      reference_type: opts?.reference_type, reference_id: opts?.reference_id,
      description: opts?.description ?? "Resgate de pontos",
    });
    const next = await applyDelta(current, -points, 0);
    await LoyaltyEventBus.publish({
      type: "PointsRedeemed", customerId, restaurantId, points, at: new Date().toISOString(),
    });
    return next;
  },

  async redeemCashback(customerId: string, restaurantId: string, amount: number, opts?: { reference_type?: string; reference_id?: string; description?: string }) {
    if (amount <= 0) throw new Error("amount must be > 0");
    const current = await ensureBalance(customerId, restaurantId);
    if (current.cashback_balance < amount) throw new Error("Insufficient cashback");
    await insertTransaction({
      customer_id: customerId, restaurant_id: restaurantId,
      transaction_type: "CASHBACK_REDEEMED", cashback: -amount,
      reference_type: opts?.reference_type, reference_id: opts?.reference_id,
      description: opts?.description ?? "Resgate de cashback",
    });
    const next = await applyDelta(current, 0, -amount);
    await LoyaltyEventBus.publish({
      type: "CashbackRedeemed", customerId, restaurantId, amount, at: new Date().toISOString(),
    });
    return next;
  },

  async redeemReward(customerId: string, restaurantId: string, reward: Reward) {
    const current = await ensureBalance(customerId, restaurantId);
    const check = RewardService.canRedeem(reward, current);
    if (!check.ok) throw new Error(`Cannot redeem: ${check.reason}`);
    const { points_delta, cashback_delta } = RewardService.applyDeltas(reward);
    if (points_delta < 0) {
      await LoyaltyService.redeemPoints(customerId, restaurantId, -points_delta, {
        reference_type: "reward", description: reward.description ?? reward.type,
      });
    }
    if (cashback_delta < 0) {
      await LoyaltyService.redeemCashback(customerId, restaurantId, -cashback_delta, {
        reference_type: "reward", description: reward.description ?? reward.type,
      });
    }
    await LoyaltyEventBus.publish({
      type: "RewardUnlocked", customerId, restaurantId,
      rewardKey: reward.type, at: new Date().toISOString(),
    });
    return LoyaltyService.getBalance(customerId, restaurantId);
  },

  async expirePoints(customerId: string, restaurantId: string, points: number, description = "Expiração") {
    if (points <= 0) return null;
    const current = await ensureBalance(customerId, restaurantId);
    const toExpire = Math.min(points, current.points_balance);
    if (toExpire === 0) return current;
    await insertTransaction({
      customer_id: customerId, restaurant_id: restaurantId,
      transaction_type: "POINTS_EXPIRED", points: -toExpire, description,
    });
    const next = await applyDelta(current, -toExpire, 0);
    await LoyaltyEventBus.publish({
      type: "PointsExpired", customerId, restaurantId, points: toExpire, at: new Date().toISOString(),
    });
    return next;
  },

  async adjust(customerId: string, restaurantId: string, deltaPoints: number, deltaCashback: number, description: string) {
    const current = await ensureBalance(customerId, restaurantId);
    await insertTransaction({
      customer_id: customerId, restaurant_id: restaurantId,
      transaction_type: "ADJUSTMENT", points: deltaPoints, cashback: deltaCashback, description,
    });
    return applyDelta(current, deltaPoints, deltaCashback,
      Math.max(0, deltaPoints), Math.max(0, deltaCashback));
  },
} as const;
