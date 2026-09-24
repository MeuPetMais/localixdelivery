import { describe, expect, it } from "vitest";
import { buildCustomer360Intelligence } from "./customer360-intelligence";
import type { Customer360ReadModel } from "./customer360";

function model(lifecycle: Customer360ReadModel["lifecycle"]): Customer360ReadModel {
  return {
    customer: {
      id: "c",
      restaurant_id: "r",
      name: "Cliente",
      phone: "11999999999",
      email: null,
      total_orders: 3,
      total_spent: 180,
      avg_ticket: 60,
      last_order_at: "2026-09-20T12:00:00.000Z",
      created_at: "2026-08-01T12:00:00.000Z",
      updated_at: "2026-09-20T12:00:00.000Z",
    },
    lifecycle,
    metric_time_basis: "UTC",
    metrics: {
      total_orders: 3,
      total_spent: 180,
      avg_ticket: 60,
      first_order_at: "2026-08-01T12:00:00.000Z",
      last_order_at: "2026-09-20T12:00:00.000Z",
      days_since_last_order: 4,
      avg_days_between_orders: 25,
      frequency_per_30d: 1.8,
      favorite_products: [{ product_id: "p1", name: "X-Bacon", qty: 4 }],
      predominant_weekday_utc: 5,
      predominant_hour_utc: 22,
      coupon_usage_count: 1,
      cancellations: 0,
      refunds: 0,
      chargebacks: 0,
    },
  };
}

describe("GROWTH-6 Customer 360 intelligence", () => {
  it("identifies second-purchase opportunity from canonical lifecycle", () => {
    const insights = buildCustomer360Intelligence(model("AWAITING_SECOND_PURCHASE"));
    expect(insights.some((i) => i.type === "SECOND_PURCHASE_OPPORTUNITY")).toBe(true);
  });

  it("identifies at-risk and inactive customers without new thresholds", () => {
    expect(buildCustomer360Intelligence(model("AT_RISK")).some((i) => i.type === "AT_RISK")).toBe(true);
    expect(buildCustomer360Intelligence(model("INACTIVE")).some((i) => i.type === "INACTIVE")).toBe(true);
  });

  it("identifies high-value, loyal and reactivated lifecycle outcomes", () => {
    expect(buildCustomer360Intelligence(model("HIGH_VALUE")).some((i) => i.type === "HIGH_VALUE")).toBe(true);
    expect(buildCustomer360Intelligence(model("LOYAL")).some((i) => i.type === "LOYAL")).toBe(true);
    expect(buildCustomer360Intelligence(model("REACTIVATED")).some((i) => i.type === "REACTIVATED")).toBe(true);
  });

  it("uses favorite product evidence already present in Customer 360", () => {
    const insight = buildCustomer360Intelligence(model("RECURRING")).find((i) => i.type === "FAVORITE_PRODUCT");
    expect(insight?.evidence.product_id).toBe("p1");
    expect(insight?.evidence.quantity).toBe(4);
  });

  it("does not emit favorite-category intelligence because Phase 1 has no authoritative category snapshot", () => {
    const types = buildCustomer360Intelligence(model("RECURRING")).map((i) => i.type);
    expect(types).not.toContain("FAVORITE_CATEGORY");
  });

  it("only recommends actions; it never sends campaigns or mutates financial/order state", () => {
    const source = JSON.stringify(buildCustomer360Intelligence(model("AT_RISK")));
    expect(source).not.toContain("SEND_CAMPAIGN");
    expect(source).not.toContain("SEND_COUPON");
    expect(source).not.toContain("OFFER_CASHBACK");
  });
});
