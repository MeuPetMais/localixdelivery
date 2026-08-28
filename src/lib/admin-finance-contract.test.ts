import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adminPresetRangeUTC,
  buildAdminDailyRevenue,
  buildAdminFinanceByRestaurant,
  resolveAdminDateRangeUTC,
  snapshotByOrderId,
  sumSnapshots,
} from "./admin-finance-contract";

describe("ADMIN-FIN-2 authoritative admin finance contract", () => {
  it("sums only persisted snapshot fields and keeps missing snapshots out of finance", () => {
    const snapshots = [
      {
        order_id: "order-1",
        customer_total: 25,
        restaurant_gross: 20,
        restaurant_net: 20,
        platform_fee: 5,
        platform_revenue: 5,
        realized_platform_revenue: 0,
        gateway_fee: 0,
      },
      {
        order_id: "order-2",
        customer_total: 50,
        restaurant_gross: 48,
        restaurant_net: 48,
        platform_fee: 2,
        platform_revenue: 2,
        realized_platform_revenue: 0,
        gateway_fee: 0,
      },
    ];

    expect(sumSnapshots(snapshots)).toMatchObject({
      orders: 2,
      customerTotal: 75,
      restaurantGross: 68,
      restaurantNet: 68,
      platformFee: 7,
      platformRevenue: 7,
      realizedPlatformRevenue: 0,
      gatewayFee: 0,
    });
    expect(snapshotByOrderId(snapshots).get("missing")).toBeUndefined();
  });

  it("uses persisted restaurant_net and realized_platform_revenue without deriving by status", () => {
    const rows = buildAdminFinanceByRestaurant(
      [{ id: "restaurant-1", name: "Parceiro" }],
      [
        { id: "order-1", restaurant_id: "restaurant-1", status: "entregue", created_at: "2026-08-28T10:00:00.000Z" },
        { id: "order-2", restaurant_id: "restaurant-1", status: "cancelado", created_at: "2026-08-28T11:00:00.000Z" },
        { id: "order-3", restaurant_id: "restaurant-1", status: "pago", created_at: "2026-08-28T12:00:00.000Z" },
        { id: "order-4", restaurant_id: "restaurant-1", status: "reembolsado", created_at: "2026-08-28T13:00:00.000Z" },
        { id: "order-5", restaurant_id: "restaurant-1", status: "chargeback", created_at: "2026-08-28T14:00:00.000Z" },
      ],
      [
        {
          order_id: "order-1",
          customer_total: 100,
          restaurant_gross: 90,
          restaurant_net: 87,
          platform_fee: 10,
          platform_revenue: 10,
          realized_platform_revenue: 0,
          gateway_fee: 3,
        },
        {
          order_id: "order-2",
          customer_total: 30,
          restaurant_gross: 28,
          restaurant_net: 28,
          platform_fee: 2,
          platform_revenue: 2,
          realized_platform_revenue: 0,
          gateway_fee: 0,
        },
        {
          order_id: "order-4",
          customer_total: 40,
          restaurant_gross: 35,
          restaurant_net: 33,
          platform_fee: 5,
          platform_revenue: 5,
          realized_platform_revenue: 0,
          gateway_fee: 2,
        },
        {
          order_id: "order-5",
          customer_total: 60,
          restaurant_gross: 50,
          restaurant_net: 48,
          platform_fee: 10,
          platform_revenue: 10,
          realized_platform_revenue: 0,
          gateway_fee: 2,
        },
      ],
    );

    expect(rows[0]).toMatchObject({
      orders: 5,
      ordersWithSnapshot: 4,
      customerTotal: 230,
      restaurantGross: 203,
      restaurantNet: 196,
      platformFee: 27,
      platformRevenue: 27,
      realizedPlatformRevenue: 0,
      gatewayFee: 7,
      missingSnapshotOrders: 1,
    });
  });

  it("interprets a single admin date as an America/Sao_Paulo civil day", () => {
    const range = resolveAdminDateRangeUTC("2026-08-28", "2026-08-28");

    expect(range.fromDate.toISOString()).toBe("2026-08-28T03:00:00.000Z");
    expect(range.toDate.toISOString()).toBe("2026-08-29T02:59:59.999Z");
  });

  it("interprets multi-day admin ranges as America/Sao_Paulo civil days", () => {
    const range = resolveAdminDateRangeUTC("2026-08-01", "2026-08-28");

    expect(range.fromDate.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(range.toDate.toISOString()).toBe("2026-08-29T02:59:59.999Z");
    expect(adminPresetRangeUTC("month", new Date("2026-08-28T23:30:00.000Z"))).toEqual({
      from: "2026-08-01",
      to: "2026-08-28",
    });
  });

  it("keeps operational boundaries aligned to the Sao Paulo civil day", () => {
    const range = resolveAdminDateRangeUTC("2026-08-28", "2026-08-28");
    const belongsToRange = (timestamp: string) => {
      const value = new Date(timestamp);
      return value >= range.fromDate && value <= range.toDate;
    };

    expect(belongsToRange("2026-08-28T02:59:59.999Z")).toBe(false);
    expect(belongsToRange("2026-08-28T03:00:00.000Z")).toBe(true);
    expect(belongsToRange("2026-08-29T02:59:59.999Z")).toBe(true);
    expect(belongsToRange("2026-08-29T03:00:00.000Z")).toBe(false);
  });

  it("groups daily revenue by the Sao Paulo civil date", () => {
    expect(buildAdminDailyRevenue(
      [
        { id: "order-1", restaurant_id: "restaurant-1", status: "pago", created_at: "2026-08-28T02:59:59.999Z" },
        { id: "order-2", restaurant_id: "restaurant-1", status: "pago", created_at: "2026-08-28T03:00:00.000Z" },
      ],
      [
        { order_id: "order-1", customer_total: 10 },
        { order_id: "order-2", customer_total: 20 },
      ],
    )).toEqual([
      { date: "08-27", revenue: 10 },
      { date: "08-28", revenue: 20 },
    ]);
  });

  it("keeps audited admin finance flows free of legacy finance math and mutations", () => {
    const source = readFileSync("src/lib/superadmin.functions.ts", "utf8");
    const dashboard = readFileSync("src/routes/admin.index.tsx", "utf8");
    const finance = readFileSync("src/routes/admin.financeiro.tsx", "utf8");
    const transactions = readFileSync("src/routes/admin.transacoes.tsx", "utf8");
    const auditedSource = source.slice(
      source.indexOf("export const getSuperadminOverview"),
      source.indexOf("export const listAdminPartners"),
    ) + source.slice(
      source.indexOf("export const listAdminTransactions"),
      source.indexOf("export const setPartnerActive"),
    );

    expect(source).toContain("order_pricing_snapshot");
    expect(auditedSource).toContain("loadSnapshotsForOrders");
    expect(auditedSource).toContain("platform_revenue");
    expect(auditedSource).toContain("realized_platform_revenue");
    expect(auditedSource).toContain("restaurant_net");
    expect(auditedSource).not.toContain("COMMISSION_RATE");
    expect(auditedSource).not.toContain("FIXED_FEE");
    expect(auditedSource).not.toMatch(/0\.99|0\.05|5\s*%|total\s*-\s*commission|count\s*\*\s*0\.99/);
    expect(auditedSource).not.toMatch(/\.insert\s*\(|\.update\s*\(|\.delete\s*\(|api\.mercadopago\.com/);
    expect(auditedSource).not.toMatch(/select\("[^"]*\btotal\b/);

    expect(dashboard).not.toContain("Receita comiss");
    expect(dashboard).not.toContain("Receita taxa fixa");
    expect(finance).toContain("Liquido parceiro");
    expect(transactions).toContain("Snapshot financeiro indisponivel");
  });
});
