// Loyalty & Rewards Engine — types.

export type LoyaltyLevelName = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | (string & {});
export type LoyaltyStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED";

export type CustomerLoyalty = {
  id: string;
  customer_id: string;
  restaurant_id: string;
  level: LoyaltyLevelName;
  points_balance: number;
  cashback_balance: number;
  lifetime_points: number;
  lifetime_cashback: number;
  status: LoyaltyStatus;
  created_at: string;
  updated_at: string;
};

export type LoyaltyTransactionType =
  | "POINTS_EARNED"
  | "POINTS_REDEEMED"
  | "POINTS_EXPIRED"
  | "POINTS_REVERSED"
  | "CASHBACK_EARNED"
  | "CASHBACK_REDEEMED"
  | "CASHBACK_EXPIRED"
  | "CASHBACK_REVERSED"
  | "ADJUSTMENT";

export type LoyaltyTransaction = {
  id: string;
  customer_id: string;
  restaurant_id: string;
  transaction_type: LoyaltyTransactionType;
  points: number;
  cashback: number;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LoyaltyLevel = {
  id: string;
  restaurant_id: string;
  name: LoyaltyLevelName;
  minimum_points: number;
  benefits: Record<string, unknown>;
  display_order: number;
  active: boolean;
};

export type LoyaltyRuleType =
  | "POINTS_PER_ORDER"
  | "POINTS_PER_AMOUNT"
  | "POINTS_PER_CATEGORY"
  | "POINTS_PER_PRODUCT"
  | "CASHBACK_PERCENT"
  | "FIRST_PURCHASE_BONUS"
  | "BIRTHDAY_BONUS"
  | "SPECIAL_DATE";

export type LoyaltyRule = {
  id: string;
  restaurant_id: string;
  name: string;
  rule_type: LoyaltyRuleType;
  config: Record<string, unknown>;
  min_order?: number | null;
  max_order?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active: boolean;
  priority: number;
};

export type RewardType = "DISCOUNT" | "FREE_PRODUCT" | "FREE_DELIVERY" | "CASHBACK";

export type Reward = {
  type: RewardType;
  points_cost?: number;
  cashback_cost?: number;
  value?: number;
  product_id?: string | null;
  description?: string;
};

export type LoyaltyContext = {
  customer_id: string;
  restaurant_id: string;
  order_id?: string;
  order_total: number;
  items?: Array<{ product_id: string; category_id?: string | null; qty: number; price: number }>;
  is_first_purchase?: boolean;
  today?: Date;
  customer_birthday?: string | null;
};

export type LoyaltyAccrual = {
  points: number;
  cashback: number;
  applied_rules: Array<{ rule_id: string; rule_type: LoyaltyRuleType; points: number; cashback: number }>;
};
