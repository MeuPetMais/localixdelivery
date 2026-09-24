import { describe, expect, it } from "vitest";
import {
  buildCustomer360ReadModel,
  normalizeCustomerPhone,
  resolveCustomer360Lifecycle,
  resolveCustomer360LifecycleFromProjection,
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


it("classifies a purchase after a long gap as reactivated", () => {
  const reactivatedCustomer = { ...customer, total_orders: 3, total_spent: 120, avg_ticket: 40 };
  const result = buildCustomer360ReadModel(
    reactivatedCustomer,
    [
      { id: "o1", total: 30, created_at: "2026-01-01T12:00:00.000Z", items: [], status: "entregue" },
      { id: "o2", total: 40, created_at: "2026-02-01T12:00:00.000Z", items: [], status: "entregue" },
      { id: "o3", total: 50, created_at: "2026-09-20T12:00:00.000Z", items: [], status: "concluido" },
    ],
    new Date("2026-09-24T12:00:00.000Z"),
  );
  expect(result.lifecycle).toBe("REACTIVATED");
});


describe("GROWTH-3 metric integrity matrix", () => {
  it("rejects projected customers with no realized sale", () => {
    const zeroCustomer = { ...customer, total_orders: 0, total_spent: 0, avg_ticket: 0, last_order_at: null };
    expect(() => buildCustomer360ReadModel(
      zeroCustomer,
      [
        { id: "n1", total: 30, created_at: "2026-09-20T12:00:00.000Z", items: [], status: "cancelado" },
      ],
      new Date("2026-09-24T12:00:00.000Z"),
    )).toThrow("at least one realized purchase");
  });

  it("excludes every non-realized status from realized metrics", () => {
    const statuses = [
      "novo",
      "aguardando_pagamento",
      "pago",
      "falha_pagamento",
      "aceito",
      "rejeitado",
      "em_preparo",
      "pronto",
      "saiu_para_entrega",
      "cancelado",
      "reembolsado",
      "chargeback",
    ];

    const realizedCustomer = { ...customer, total_orders: 2, total_spent: 70, avg_ticket: 35 };
    const result = buildCustomer360ReadModel(
      realizedCustomer,
      [
        { id: "ok1", total: 30, created_at: "2026-09-10T12:00:00.000Z", items: [], status: "entregue" },
        { id: "ok2", total: 40, created_at: "2026-09-20T12:00:00.000Z", items: [], status: "concluido" },
        ...statuses.map((status, index) => ({
          id: `x${index}`,
          total: 999,
          created_at: `2026-09-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
          items: [{ productId: "ignored", name: "Ignored", qty: 99 }],
          status,
        })),
      ],
      new Date("2026-09-24T12:00:00.000Z"),
    );

    expect(result.metrics.total_orders).toBe(2);
    expect(result.metrics.total_spent).toBe(70);
    expect(result.metrics.favorite_products).toEqual([]);
    expect(result.metrics.cancellations).toBe(1);
    expect(result.metrics.refunds).toBe(1);
    expect(result.metrics.chargebacks).toBe(1);
  });

  it("keeps list and detail lifecycle thresholds consistent", () => {
    expect(resolveCustomer360LifecycleFromProjection({
      totalOrders: 2,
      totalSpent: 100,
      lastOrderAt: "2026-08-01T00:00:00.000Z",
      now: new Date("2026-09-24T00:00:00.000Z"),
    })).toBe("AT_RISK");

    expect(resolveCustomer360LifecycleFromProjection({
      totalOrders: 2,
      totalSpent: 100,
      lastOrderAt: "2026-06-01T00:00:00.000Z",
      now: new Date("2026-09-24T00:00:00.000Z"),
    })).toBe("INACTIVE");

    expect(resolveCustomer360LifecycleFromProjection({
      totalOrders: 6,
      totalSpent: 300,
      lastOrderAt: "2026-09-20T00:00:00.000Z",
      now: new Date("2026-09-24T00:00:00.000Z"),
    })).toBe("LOYAL");

    expect(resolveCustomer360LifecycleFromProjection({
      totalOrders: 3,
      totalSpent: 600,
      lastOrderAt: "2026-09-20T00:00:00.000Z",
      now: new Date("2026-09-24T00:00:00.000Z"),
    })).toBe("HIGH_VALUE");
  });

  it("computes frequency and predominant UTC behavior deterministically", () => {
    const result = buildCustomer360ReadModel(
      { ...customer, total_orders: 3, total_spent: 120, avg_ticket: 40, last_order_at: "2026-09-21T18:00:00.000Z" },
      [
        { id: "o1", total: 30, created_at: "2026-09-01T18:00:00.000Z", items: [], status: "entregue" },
        { id: "o2", total: 40, created_at: "2026-09-11T18:00:00.000Z", items: [], status: "entregue" },
        { id: "o3", total: 50, created_at: "2026-09-21T18:00:00.000Z", items: [], status: "concluido" },
      ],
      new Date("2026-10-01T18:00:00.000Z"),
    );

    expect(result.metrics.avg_days_between_orders).toBe(10);
    expect(result.metrics.frequency_per_30d).toBeCloseTo(3, 1);
    expect(result.metrics.predominant_hour_utc).toBe(18);
    expect(result.metric_time_basis).toBe("UTC");
  });

  it("aggregates favorite products across historical item shapes", () => {
    const result = buildCustomer360ReadModel(
      { ...customer, total_orders: 2, total_spent: 80, avg_ticket: 40 },
      [
        {
          id: "o1",
          total: 40,
          created_at: "2026-09-10T12:00:00.000Z",
          items: [{ product_id: "p1", name: "Burger", quantity: 2 }],
          status: "entregue",
        },
        {
          id: "o2",
          total: 40,
          created_at: "2026-09-20T12:00:00.000Z",
          items: [{ id: "p1", name: "Burger", qty: 3 }],
          status: "concluido",
        },
      ],
      new Date("2026-09-24T12:00:00.000Z"),
    );

    expect(result.metrics.favorite_products[0]).toEqual({
      product_id: "p1",
      name: "Burger",
      qty: 5,
    });
  });

  it("does not allow zero-purchase lifecycle classification in projection summaries", () => {
    expect(() => resolveCustomer360LifecycleFromProjection({
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: null,
      now: new Date("2026-09-24T00:00:00.000Z"),
    })).toThrow("at least one realized purchase");
  });
});
