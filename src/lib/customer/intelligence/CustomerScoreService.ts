import type { CustomerAnalytics, CustomerScore, CustomerScoreBreakdown } from "./types";

/**
 * CustomerScoreService — pure RFM+Loyalty+Engagement scoring (0..100).
 */
function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export const CustomerScoreService = {
  compute(
    a: CustomerAnalytics,
    ctx: { loyaltyPoints?: number; loyaltyLevelRank?: number; engagementSignals?: number } = {},
  ): CustomerScore {
    // Recency: 100 if <=3d, 0 if >=90d
    const recency = a.days_since_last_order >= 90
      ? 0
      : clamp(100 - (a.days_since_last_order / 90) * 100);

    // Frequency: 100 at >=8 orders/month
    const frequency = clamp((a.frequency_per_month / 8) * 100);

    // Monetary: 100 at >=R$1500 lifetime
    const monetary = clamp((a.total_spent / 1500) * 100);

    // Loyalty: level rank 0..4 => 0..100, plus points contribution
    const rank = ctx.loyaltyLevelRank ?? 0;
    const points = ctx.loyaltyPoints ?? 0;
    const loyalty = clamp(rank * 20 + Math.min(20, points / 100));

    // Engagement: opens/clicks/logins normalized 0..1
    const engagement = clamp((ctx.engagementSignals ?? 0) * 100);

    const breakdown: CustomerScoreBreakdown = {
      recency: Math.round(recency),
      frequency: Math.round(frequency),
      monetary: Math.round(monetary),
      loyalty: Math.round(loyalty),
      engagement: Math.round(engagement),
    };

    const health_score = Math.round(
      breakdown.recency * 0.30 +
      breakdown.frequency * 0.25 +
      breakdown.monetary * 0.25 +
      breakdown.loyalty * 0.15 +
      breakdown.engagement * 0.05,
    );

    return {
      customer_id: a.customer_id,
      restaurant_id: a.restaurant_id,
      health_score,
      breakdown,
    };
  },
} as const;
