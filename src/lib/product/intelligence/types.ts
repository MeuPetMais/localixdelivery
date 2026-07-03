/* eslint-disable @typescript-eslint/no-explicit-any */
export type ProductInsightType =
  | "BEST_SELLER" | "LOW_SELLER" | "HIGH_MARGIN" | "LOW_MARGIN"
  | "OUT_OF_STOCK" | "PRICE_REVIEW" | "PROMOTION" | "CROSS_SELL" | "UPSELL";

export type ProductInsightSeverity = "info" | "warning" | "critical";

export interface ProductInsight {
  id?: string;
  restaurant_id: string;
  product_id?: string | null;
  insight_type: ProductInsightType;
  severity: ProductInsightSeverity;
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
}

export type RecommendationType =
  | "FEATURED" | "HIDE" | "PRICE_REVIEW" | "RECIPE_REVIEW"
  | "MARGIN_REVIEW" | "CROSS_SELL" | "UPSELL";

export interface ProductRecommendation {
  id?: string;
  restaurant_id: string;
  recommendation_type: RecommendationType;
  product_id?: string | null;
  related_product_id?: string | null;
  score: number;
  status?: string;
  metadata?: Record<string, any>;
  generated_at?: string;
}

export interface ProductSalesStat {
  product_id: string;
  name?: string;
  category_id?: string | null;
  units_sold: number;
  revenue: number;
  cost: number; // CMV total
  orders: number;
  price: number; // preço unitário atual
}

export interface OrderLineSample {
  order_id: string;
  product_id: string;
  quantity: number;
}

export interface ProductPerformance {
  product_id: string;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
  orders: number;
  units: number;
  avg_ticket: number;
}

export interface ProductHealthScore {
  product_id: string;
  score: number; // 0-100
  breakdown: { sales: number; margin: number; availability: number; reviews: number };
}
