// Business Rules Engine — tipos públicos.
// Puramente estruturais; não contêm I/O.

import type { OpeningHours } from "@/lib/restaurant-status";

export type BusinessRuleCategory =
  | "ORDER"
  | "PAYMENT"
  | "DELIVERY"
  | "COUPON"
  | "LOYALTY"
  | "RESTAURANT"
  | "CUSTOMER"
  | "FINANCIAL"
  | "SYSTEM";

export type BusinessRuleSeverity = "info" | "warning" | "error" | "critical";

export interface BusinessRuleResult {
  allowed: boolean;
  reason?: string;
  rule_code: string;
  severity: BusinessRuleSeverity;
  metadata?: Record<string, unknown>;
}

export interface BusinessRuleContext {
  customer?: {
    id?: string | null;
    active?: boolean;
    blocked?: boolean;
    phone_confirmed?: boolean;
    email_confirmed?: boolean;
    daily_orders?: number;
    first_purchase?: boolean;
  } | null;
  restaurant?: {
    id?: string | null;
    active?: boolean;
    blocked?: boolean;
    accepting_orders?: boolean;
    is_open?: boolean;
    min_order?: number;
    delivery_radius_km?: number;
    max_concurrent_orders?: number;
    current_open_orders?: number;
    prep_time_minutes?: number;
    opening_hours?: OpeningHours;
    timezone?: string | null;
    timeZone?: string | null;
  } | null;
  order?: {
    id?: string | null;
    subtotal?: number;
    total?: number;
    items_count?: number;
    duplicate_of?: string | null;
    created_at?: string;
    from_status?: string;
    to_status?: string;
  } | null;
  payment?: {
    method?: string;
    status?: string;
    expires_at?: string | null;
    mp_connected?: boolean;
    mp_token_valid?: boolean;
    seconds_since_created?: number;
    max_wait_seconds?: number;
  } | null;
  delivery?: {
    distance_km?: number;
    inside_service_area?: boolean;
    available?: boolean;
    fee?: number;
  } | null;
  coupon?: {
    code?: string;
    active?: boolean;
    expires_at?: string | null;
    max_uses?: number;
    uses?: number;
    min_order?: number;
    first_purchase_only?: boolean;
    allowed_categories?: string[];
    order_categories?: string[];
  } | null;
  cashback?: {
    eligible?: boolean;
    amount?: number;
    max_amount?: number;
    expires_at?: string | null;
    stackable?: boolean;
  } | null;
  platform?: {
    maintenance?: boolean;
    min_order_global?: number;
  } | null;
  system_time?: string; // ISO
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  category: BusinessRuleCategory;
  evaluate(ctx: BusinessRuleContext): BusinessRuleResult | Promise<BusinessRuleResult>;
}

export type RuleEventName = "RuleExecuted" | "RulePassed" | "RuleRejected";

export interface RuleEventPayload {
  rule_code: string;
  category: BusinessRuleCategory;
  result: BusinessRuleResult;
  execution_time_ms: number;
  occurred_at: string;
  context_ref?: {
    order_id?: string | null;
    customer_id?: string | null;
    restaurant_id?: string | null;
  };
}
