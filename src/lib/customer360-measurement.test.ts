import { describe, expect, it } from "vitest";
import { summarizeGrowthMeasurement } from "./customer360-measurement";
import type { GrowthMeasurementEvent } from "./customer360-measurement";

function event(
  event_type: GrowthMeasurementEvent["event_type"],
  overrides: Partial<GrowthMeasurementEvent> = {},
): GrowthMeasurementEvent {
  return {
    restaurant_id: "r",
    customer_id: "c",
    event_type,
    source_type: "CUSTOMER360_INTELLIGENCE",
    source_ref: "AT_RISK",
    action_key: "REACTIVATE_CUSTOMER",
    order_id: null,
    attributed_order_total: null,
    occurred_at: "2026-09-24T12:00:00.000Z",
    metadata: {},
    idempotency_key: Math.random().toString(),
    ...overrides,
  };
}

describe("GROWTH-7 measurement summary", () => {
  it("measures the funnel without inventing conversions", () => {
    const summary = summarizeGrowthMeasurement([
      event("OPPORTUNITY_VIEWED"),
      event("OPPORTUNITY_VIEWED"),
      event("ACTION_SELECTED"),
      event("ACTION_EXECUTED"),
      event("ORDER_ATTRIBUTED", { order_id: "o1", attributed_order_total: 80 }),
    ]);
    expect(summary.opportunity_views).toBe(2);
    expect(summary.actions_selected).toBe(1);
    expect(summary.actions_executed).toBe(1);
    expect(summary.attributed_orders).toBe(1);
    expect(summary.attributed_order_total).toBe(80);
    expect(summary.view_to_action_rate).toBe(50);
    expect(summary.action_to_order_rate).toBe(100);
  });

  it("returns null rates when there is no denominator", () => {
    const summary = summarizeGrowthMeasurement([]);
    expect(summary.view_to_action_rate).toBeNull();
    expect(summary.action_to_order_rate).toBeNull();
  });

  it("counts distinct customers with attributed orders", () => {
    const summary = summarizeGrowthMeasurement([
      event("ORDER_ATTRIBUTED", { customer_id: "c1", order_id: "o1", attributed_order_total: 40 }),
      event("ORDER_ATTRIBUTED", { customer_id: "c1", order_id: "o2", attributed_order_total: 60 }),
      event("ORDER_ATTRIBUTED", { customer_id: "c2", order_id: "o3", attributed_order_total: 50 }),
    ]);
    expect(summary.customers_with_attributed_order).toBe(2);
    expect(summary.attributed_order_total).toBe(150);
  });
});
