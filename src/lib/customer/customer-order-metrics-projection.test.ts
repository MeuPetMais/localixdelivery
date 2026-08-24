import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type OrderStatus =
  | "novo"
  | "aguardando_pagamento"
  | "pago"
  | "aceito"
  | "em_preparo"
  | "pronto"
  | "saiu_para_entrega"
  | "entregue"
  | "concluido"
  | "falha_pagamento"
  | "cancelado"
  | "rejeitado"
  | "reembolsado"
  | "chargeback";

type ProjectionOrder = {
  restaurantId: string;
  customerPhone: string | null;
  total: number;
  status: OrderStatus;
  createdAt: string;
};

const REALIZED_SALE_STATUSES = new Set<OrderStatus>(["entregue", "concluido"]);
const normalizeLineEndings = (source: string) => source.replace(/\r\n/g, "\n");
const ALL_STATUSES: OrderStatus[] = [
  "novo",
  "aguardando_pagamento",
  "pago",
  "aceito",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "entregue",
  "concluido",
  "falha_pagamento",
  "cancelado",
  "rejeitado",
  "reembolsado",
  "chargeback",
];

const normalizePhone = (phone: string | null) => (phone ?? "").replace(/\D/g, "");

function duplicateNormalizedCustomerGroups(customers: Array<{ restaurantId: string; phone: string | null }>) {
  const groups = new Map<string, number>();

  for (const customer of customers) {
    const normalizedPhone = normalizePhone(customer.phone);
    if (normalizedPhone === "") continue;

    const key = `${customer.restaurantId}:${normalizedPhone}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return [...groups.entries()].filter(([, count]) => count > 1);
}

function rebuildCustomerOrderMetrics(orders: ProjectionOrder[], restaurantId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const eligibleOrders = orders.filter(
    (order) =>
      order.restaurantId === restaurantId &&
      normalizePhone(order.customerPhone) === normalizedPhone &&
      REALIZED_SALE_STATUSES.has(order.status),
  );

  const totalOrders = eligibleOrders.length;
  const totalSpent = eligibleOrders.reduce((sum, order) => sum + order.total, 0);

  return {
    total_orders: totalOrders,
    total_spent: totalSpent,
    avg_ticket: totalOrders > 0 ? Math.round((totalSpent / totalOrders) * 100) / 100 : 0,
    last_order_at:
      eligibleOrders.length > 0
        ? eligibleOrders
            .map((order) => order.createdAt)
            .sort()
            .at(-1) ?? null
        : null,
  };
}

describe("customers order metrics projection", () => {
  it("keeps a new pago order out of realized customer aggregates", () => {
    const result = rebuildCustomerOrderMetrics(
      [{ restaurantId: "r1", customerPhone: "(11) 99999-0000", total: 50, status: "pago", createdAt: "2026-01-01T10:00:00Z" }],
      "r1",
      "11999990000",
    );

    expect(result).toEqual({ total_orders: 0, total_spent: 0, avg_ticket: 0, last_order_at: null });
  });

  it("counts the same order after pago to entregue", () => {
    const orders = [{ restaurantId: "r1", customerPhone: "11999990000", total: 50, status: "pago" as OrderStatus, createdAt: "2026-01-01T10:00:00Z" }];

    orders[0].status = "entregue";

    expect(rebuildCustomerOrderMetrics(orders, "r1", "11999990000")).toEqual({
      total_orders: 1,
      total_spent: 50,
      avg_ticket: 50,
      last_order_at: "2026-01-01T10:00:00Z",
    });
  });

  it("does not double count when entregue becomes concluido", () => {
    const orders = [{ restaurantId: "r1", customerPhone: "11999990000", total: 50, status: "entregue" as OrderStatus, createdAt: "2026-01-01T10:00:00Z" }];

    orders[0].status = "concluido";

    expect(rebuildCustomerOrderMetrics(orders, "r1", "11999990000").total_orders).toBe(1);
  });

  it.each(["reembolsado", "chargeback"] satisfies OrderStatus[])("removes aggregates when concluido becomes %s", (status) => {
    const orders = [{ restaurantId: "r1", customerPhone: "11999990000", total: 50, status, createdAt: "2026-01-01T10:00:00Z" }];

    expect(rebuildCustomerOrderMetrics(orders, "r1", "11999990000")).toEqual({
      total_orders: 0,
      total_spent: 0,
      avg_ticket: 0,
      last_order_at: null,
    });
  });

  it("sums two valid orders and derives average ticket", () => {
    const result = rebuildCustomerOrderMetrics(
      [
        { restaurantId: "r1", customerPhone: "11999990000", total: 50, status: "entregue", createdAt: "2026-01-01T10:00:00Z" },
        { restaurantId: "r1", customerPhone: "11999990000", total: 80, status: "concluido", createdAt: "2026-01-02T10:00:00Z" },
      ],
      "r1",
      "11999990000",
    );

    expect(result).toEqual({
      total_orders: 2,
      total_spent: 130,
      avg_ticket: 65,
      last_order_at: "2026-01-02T10:00:00Z",
    });
  });

  it("counts only valid orders when failed payment exists for the same phone", () => {
    const result = rebuildCustomerOrderMetrics(
      [
        { restaurantId: "r1", customerPhone: "11999990000", total: 50, status: "entregue", createdAt: "2026-01-01T10:00:00Z" },
        { restaurantId: "r1", customerPhone: "11999990000", total: 80, status: "falha_pagamento", createdAt: "2026-01-02T10:00:00Z" },
      ],
      "r1",
      "11999990000",
    );

    expect(result.total_orders).toBe(1);
    expect(result.total_spent).toBe(50);
  });

  it("isolates the same phone across restaurants", () => {
    const orders = [
      { restaurantId: "r1", customerPhone: "11999990000", total: 50, status: "entregue", createdAt: "2026-01-01T10:00:00Z" },
      { restaurantId: "r2", customerPhone: "11999990000", total: 90, status: "entregue", createdAt: "2026-01-02T10:00:00Z" },
    ] satisfies ProjectionOrder[];

    expect(rebuildCustomerOrderMetrics(orders, "r1", "11999990000").total_spent).toBe(50);
    expect(rebuildCustomerOrderMetrics(orders, "r2", "11999990000").total_spent).toBe(90);
  });

  it("is idempotent when rebuild runs twice", () => {
    const orders = [{ restaurantId: "r1", customerPhone: "11999990000", total: 50, status: "entregue", createdAt: "2026-01-01T10:00:00Z" }] satisfies ProjectionOrder[];

    expect(rebuildCustomerOrderMetrics(orders, "r1", "11999990000")).toEqual(rebuildCustomerOrderMetrics(orders, "r1", "11999990000"));
  });

  it("replaces contaminated persisted values with the rebuilt projection", () => {
    const contaminated = { total_orders: 9, total_spent: 999, avg_ticket: 111, last_order_at: "2026-01-09T10:00:00Z" };
    const rebuilt = rebuildCustomerOrderMetrics(
      [{ restaurantId: "r1", customerPhone: "11999990000", total: 50, status: "entregue", createdAt: "2026-01-01T10:00:00Z" }],
      "r1",
      "11999990000",
    );

    expect(contaminated).not.toEqual(rebuilt);
    expect(rebuilt).toEqual({ total_orders: 1, total_spent: 50, avg_ticket: 50, last_order_at: "2026-01-01T10:00:00Z" });
  });

  it("documents all non-realized statuses as excluded from customer aggregates", () => {
    for (const status of ALL_STATUSES) {
      const result = rebuildCustomerOrderMetrics(
        [{ restaurantId: "r1", customerPhone: "11999990000", total: 50, status, createdAt: "2026-01-01T10:00:00Z" }],
        "r1",
        "11999990000",
      );

      expect(result.total_orders).toBe(REALIZED_SALE_STATUSES.has(status) ? 1 : 0);
    }
  });

  it("keeps the migration scoped to status-triggered customer projection", () => {
    const migration = normalizeLineEndings(readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260819222920_customers_order_metrics_projection_rebuild.sql"),
      "utf8",
    ));

    expect(migration.indexOf("customers duplicated by normalized key")).toBeLessThan(migration.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_normalized_phone_uidx"));
    expect(migration.indexOf("customers_restaurant_normalized_phone_uidx")).toBeLessThan(migration.indexOf("CREATE OR REPLACE FUNCTION private.rebuild_customer_order_metrics"));
    expect(migration).toContain("CREATE OR REPLACE FUNCTION private.rebuild_customer_order_metrics");
    expect(migration).toContain("AND o.status IN ('entregue', 'concluido')");
    expect(migration).toContain("AFTER INSERT OR UPDATE OF status ON public.orders");
    expect(migration).toContain("NEW.status IS NOT DISTINCT FROM OLD.status");
    expect(migration).toContain("ON CONFLICT (\n    restaurant_id,\n    (pg_catalog.regexp_replace(coalesce(phone, ''), '\\D', '', 'g'))");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS orders_customer_metrics_rebuild_idx");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION private.rebuild_customer_order_metrics");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION private.upsert_customer_from_order");
    expect(migration).not.toContain("UPDATE OF customer_phone");
    expect(migration).not.toContain("UPDATE OF total");
  });

  it("documents that formatting characters are removed but Brazilian DDI is not inferred", () => {
    expect(normalizePhone("(11) 99999-9999")).toBe("11999999999");
    expect(normalizePhone("+55 11 99999-9999")).toBe("5511999999999");
    expect(normalizePhone("5511999999999")).toBe("5511999999999");
    expect(normalizePhone("(11) 99999-9999")).not.toBe(normalizePhone("+55 11 99999-9999"));
  });

  it("aborts the migration strategy when duplicate normalized customers already exist", () => {
    expect(
      duplicateNormalizedCustomerGroups([
        { restaurantId: "r1", phone: "(11) 99999-9999" },
        { restaurantId: "r1", phone: "11999999999" },
      ]),
    ).toEqual([["r1:11999999999", 2]]);
  });

  it("allows the same normalized phone in different restaurants", () => {
    expect(
      duplicateNormalizedCustomerGroups([
        { restaurantId: "r1", phone: "(11) 99999-9999" },
        { restaurantId: "r2", phone: "11999999999" },
      ]),
    ).toEqual([]);
  });
});
