import type { CustomerAnalytics, CustomerScore, CustomerSegment } from "./types";

/**
 * Pure segmentation from analytics + score.
 * Segments are non-exclusive by nature; this returns the *primary* segment and an
 * ordered list of applicable tags.
 */
export const CustomerSegmentationService = {
  resolve(a: CustomerAnalytics, score: CustomerScore): { primary: CustomerSegment; tags: CustomerSegment[]; reason: string } {
    const tags: CustomerSegment[] = [];

    if (a.total_orders <= 1) tags.push("NEW");
    if (a.days_since_last_order <= 30 && a.total_orders >= 2) tags.push("ACTIVE");
    if (a.total_orders >= 5 && score.breakdown.loyalty >= 40) tags.push("LOYAL");
    if (a.total_spent >= 800 || score.health_score >= 80) tags.push("VIP");
    if (a.days_since_last_order > 45 && a.days_since_last_order <= 90 && a.total_orders >= 2) tags.push("AT_RISK");
    if (a.days_since_last_order > 90) tags.push("INACTIVE");
    if (a.avg_ticket >= 80) tags.push("HIGH_VALUE");
    if (a.avg_ticket < 25 && a.total_orders >= 2) tags.push("LOW_VALUE");

    // priority order
    const priority: CustomerSegment[] = [
      "VIP", "AT_RISK", "INACTIVE", "LOYAL", "HIGH_VALUE", "ACTIVE", "LOW_VALUE", "NEW",
    ];
    const primary = priority.find((p) => tags.includes(p)) ?? "NEW";
    const reason = `orders=${a.total_orders}, spent=${a.total_spent}, avg=${a.avg_ticket}, recency=${a.days_since_last_order}d, health=${score.health_score}`;

    return { primary, tags, reason };
  },
} as const;
