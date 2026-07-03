import type { Reward, CustomerLoyalty } from "./types";

/**
 * RewardService — pure catalog of redemption rules.
 * Decides whether a customer's balance can afford a reward.
 */
export const RewardService = {
  canRedeem(reward: Reward, balance: Pick<CustomerLoyalty, "points_balance" | "cashback_balance">):
    { ok: true } | { ok: false; reason: string } {
    if (reward.points_cost != null && reward.points_cost > balance.points_balance) {
      return { ok: false, reason: "insufficient_points" };
    }
    if (reward.cashback_cost != null && reward.cashback_cost > balance.cashback_balance) {
      return { ok: false, reason: "insufficient_cashback" };
    }
    if ((reward.points_cost ?? 0) <= 0 && (reward.cashback_cost ?? 0) <= 0) {
      return { ok: false, reason: "invalid_cost" };
    }
    return { ok: true };
  },

  applyDeltas(reward: Reward): { points_delta: number; cashback_delta: number } {
    return {
      points_delta: -(reward.points_cost ?? 0),
      cashback_delta: -(reward.cashback_cost ?? 0),
    };
  },
} as const;
