import { describe, expect, it } from "vitest";
import {
  buildCustomer360ReadModel,
  normalizeCustomerPhone,
  resolveCustomer360Lifecycle,
  type Customer360Customer,
} from "./customer360";

const customer: Customer360Customer = {
  id: "00000000-0000-0000-0000-000000000001",
  restaurant_id: "00000000-0000-0000-0000-000000000002",
  name: "Cliente Guest",
  phone: "11999999999",
  email: null,
  total_orders: 2,
  total_spent: 90,
  avg_ticket: 45,
  last_order_at: "2026-09-20T12:00:00.000Z",
  created_at: "2026-09-01T12:00:00.000Z",
  updated_at: "2026-09-20T12:00:00.000Z",
};

describe("Customer 360 read model", () => {
  it("normalizes phone identity", () => {
    expect(normalizeCustomerPhone("(11) 99999-9999")).toBe("11999999999");
  });

  it("uses only realized orders for behavioral metrics", () => {
    const result = buildCustomer360ReadModel(
      customer,
      [
        {
          id: "o1",
          total: 40,
          created_at: "2026-09-10T12:00:00.000Z",
          items: [{ productId: "p1", name: "Pizza", qty: 1 }],
          payment_method: "pix",
          status: "entregue",
          coupon_id: "c1",
        },
        {
          id: "o2",
          total: 50,
          created_at: "2026-09-20T12:00:00.000Z",
          items: [{ productId: "p1", name: "Pizza", qty: 2 }],
          payment_method: "pix",
          status: "concluido",
          coupon_id: null,
        },
        {
          id: "o3",
          total: 100,
          created_at: "2026-09-22T12:00:00.000Z",
          items: [{ productId: "p2", name: "Cancelado", qty: 1 }],
          payment_method: "card",
          status: "cancelado",
          coupon_id: null,
        },
      ],
      new Date("2026-09-24T12:00:00.000Z"),
    );

    expect(result.metrics.total_orders).toBe(2);
    expect(result.metrics.total_spent).toBe(90);
    expect(result.metrics.avg_ticket).toBe(45);
    expect(result.metrics.first_order_at).toBe("2026-09-10T12:00:00.000Z");
    expect(result.metrics.days_since_last_order).toBe(4);
    expect(result.metrics.avg_days_between_orders).toBe(10);
    expect(result.metrics.favorite_products[0]).toMatchObject({ product_id: "p1", qty: 3 });
    expect(result.metrics.coupon_usage_count).toBe(1);
    expect(result.metrics.cancellations).toBe(1);
    expect(result.lifecycle).toBe("RECURRING");
  });

  it("classifies one recent purchase as awaiting second purchase", () => {
    expect(resolveCustomer360Lifecycle({
      total_orders: 1,
      total_spent: 30,
      avg_ticket: 30,
      first_order_at: "2026-09-20T00:00:00.000Z",
      last_order_at: "2026-09-20T00:00:00.000Z",
      days_since_last_order: 4,
      avg_days_between_orders: null,
      frequency_per_30d: 1,
      favorite_products: [],
      predominant_weekday_utc: 0,
      predominant_hour_utc: 12,
      coupon_usage_count: 0,
      cancellations: 0,
      refunds: 0,
      chargebacks: 0,
    })).toBe("AWAITING_SECOND_PURCHASE");
  });
});
