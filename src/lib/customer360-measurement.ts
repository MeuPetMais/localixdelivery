import type { Customer360Insight } from "@/lib/customer360-intelligence";

export type GrowthMeasurementEventType =
  | "OPPORTUNITY_VIEWED"
  | "ACTION_SELECTED"
  | "ACTION_EXECUTED"
  | "ORDER_ATTRIBUTED";

export type GrowthMeasurementEvent = {
  id?: string;
  restaurant_id: string;
  customer_id: string;
  event_type: GrowthMeasurementEventType;
  source_type: string;
  source_ref: string | null;
  action_key: string | null;
  order_id: string | null;
  attributed_order_total: number | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  idempotency_key: string;
};

export type GrowthMeasurementSummary = {
  opportunity_views: number;
  actions_selected: number;
  actions_executed: number;
  attributed_orders: number;
  attributed_order_total: number;
  customers_with_attributed_order: number;
  view_to_action_rate: number | null;
  action_to_order_rate: number | null;
};

function rate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function summarizeGrowthMeasurement(
  events: GrowthMeasurementEvent[],
): GrowthMeasurementSummary {
  const opportunityViews = events.filter((e) => e.event_type === "OPPORTUNITY_VIEWED").length;
  const actionsSelected = events.filter((e) => e.event_type === "ACTION_SELECTED").length;
  const actionsExecuted = events.filter((e) => e.event_type === "ACTION_EXECUTED").length;
  const orders = events.filter((e) => e.event_type === "ORDER_ATTRIBUTED");
  const customersWithAttributedOrder = new Set(orders.map((e) => e.customer_id)).size;

  return {
    opportunity_views: opportunityViews,
    actions_selected: actionsSelected,
    actions_executed: actionsExecuted,
    attributed_orders: orders.length,
    attributed_order_total:
      Math.round(orders.reduce((sum, e) => sum + Number(e.attributed_order_total ?? 0), 0) * 100) / 100,
    customers_with_attributed_order: customersWithAttributedOrder,
    view_to_action_rate: rate(actionsSelected, opportunityViews),
    action_to_order_rate: rate(orders.length, actionsExecuted),
  };
}

export function measurementSourceForInsight(insight: Customer360Insight) {
  return {
    source_type: "CUSTOMER360_INTELLIGENCE",
    source_ref: insight.type,
    action_key: insight.recommended_action,
  };
}
