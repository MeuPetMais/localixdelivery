// Customer Intelligence & Analytics — shared types.

export type CustomerSegment =
  | "NEW"
  | "ACTIVE"
  | "LOYAL"
  | "VIP"
  | "AT_RISK"
  | "INACTIVE"
  | "HIGH_VALUE"
  | "LOW_VALUE";

export type CustomerInsightType =
  | "NO_PURCHASE"
  | "VIP_INACTIVE"
  | "AT_RISK"
  | "TICKET_DROP"
  | "FREQUENCY_DROP"
  | "BEHAVIOR_CHANGE"
  | "FAVORITE_CATEGORY"
  | "NEAR_LEVEL_UP";

export type CustomerInsightSeverity = "info" | "warning" | "critical" | "success";

export type CustomerAnalytics = {
  customer_id: string;
  restaurant_id: string;
  total_orders: number;
  total_spent: number;
  avg_ticket: number;
  frequency_per_month: number;
  days_since_last_order: number;
  tenure_days: number;
  favorite_products: Array<{ product_id: string; name?: string; qty: number }>;
  favorite_categories: Array<{ category_id: string; name?: string; qty: number }>;
  favorite_channel: string | null;
};

export type CustomerScoreBreakdown = {
  recency: number;      // 0-100
  frequency: number;    // 0-100
  monetary: number;     // 0-100
  loyalty: number;      // 0-100
  engagement: number;   // 0-100
};

export type CustomerScore = {
  customer_id: string;
  restaurant_id: string;
  health_score: number; // 0-100
  breakdown: CustomerScoreBreakdown;
};

export type CustomerSegmentRecord = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  segment: CustomerSegment;
  score: number;
  reason: string | null;
  metadata: Record<string, unknown>;
  generated_at: string;
};

export type CustomerInsightRecord = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  insight_type: CustomerInsightType;
  severity: CustomerInsightSeverity;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  acknowledged_at: string | null;
  generated_at: string;
};

export type CustomerRecommendationAction =
  | "SEND_COUPON"
  | "OFFER_CASHBACK"
  | "OFFER_COMBO"
  | "SEND_CAMPAIGN"
  | "HIGHLIGHT_PRODUCT"
  | "REACTIVATE";

export type CustomerRecommendation = {
  customer_id: string;
  action: CustomerRecommendationAction;
  reason: string;
  priority: number; // 1-10
  metadata?: Record<string, unknown>;
};
