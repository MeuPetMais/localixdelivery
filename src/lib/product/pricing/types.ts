// Dynamic Pricing & Promotion Engine — Types
// NÃO substitui PricingEngine. Apenas calcula descontos e delega totais finais.
/* eslint-disable @typescript-eslint/no-explicit-any */
type JsonObject = Record<string, any>;

export type PromotionStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "EXPIRED"
  | "ARCHIVED";

export type PromotionDiscountType =
  | "FIXED_AMOUNT"
  | "PERCENTAGE"
  | "FIXED_PRICE"
  | "BUY_X_GET_Y"
  | "FREE_ITEM"
  | "FREE_DELIVERY";

export type PromotionChannel = "delivery" | "pickup" | "dine_in" | "qr" | "totem" | "all";

export type PromotionRuleType =
  | "time_window"
  | "weekday"
  | "channel"
  | "payment_method"
  | "category"
  | "product"
  | "customer"
  | "first_purchase"
  | "min_subtotal"
  | "min_quantity";

export interface PromotionRule {
  id: string;
  promotion_id: string;
  rule_type: PromotionRuleType | string;
  operator: string; // eq | in | gte | lte | between
  value: JsonObject;
  created_at?: string;
}

export interface PromotionTarget {
  id: string;
  promotion_id: string;
  target_type: "product" | "category" | "all" | string;
  target_id: string | null;
  created_at?: string;
}

export interface Promotion {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string | null;
  status: PromotionStatus;
  priority: number;
  start_date?: string | null;
  end_date?: string | null;
  discount_type: PromotionDiscountType;
  discount_value: number;
  stackable: boolean;
  code?: string | null;
  channel?: string | null;
  max_uses?: number | null;
  max_uses_per_customer?: number | null;
  config?: JsonObject;
  created_at?: string;
  updated_at?: string;
  rules?: PromotionRule[];
  targets?: PromotionTarget[];
}

export interface CartLine {
  product_id: string;
  category_id?: string | null;
  name?: string;
  quantity: number;
  unit_price: number;
}

export interface PricingContext {
  restaurant_id: string;
  customer_id?: string | null;
  is_first_purchase?: boolean;
  channel?: PromotionChannel | string;
  payment_method?: string;
  now?: Date;
  coupon_code?: string | null;
  lines: CartLine[];
  subtotal?: number;
  delivery_fee?: number;
}

export interface AppliedPromotion {
  promotion_id: string;
  name: string;
  discount_type: PromotionDiscountType;
  discount_amount: number;
  free_delivery?: boolean;
  free_items?: { product_id: string; quantity: number }[];
  matched_lines?: string[];
}

export interface DynamicPricingResult {
  subtotal: number;
  original_subtotal: number;
  total_discount: number;
  delivery_fee: number;
  free_delivery: boolean;
  applied_promotions: AppliedPromotion[];
  skipped: { promotion_id: string; reason: string }[];
}
