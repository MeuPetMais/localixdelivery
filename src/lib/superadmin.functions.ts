import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildAdminDailyRevenue,
  buildAdminFinanceByRestaurant,
  money,
  resolveAdminDateRangeUTC,
  snapshotByOrderId,
  sumSnapshots,
  type AdminOrderMetricRow,
  type AdminRestaurantMetricRow,
  type AdminSnapshotMetricRow,
} from "./admin-finance-contract";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const DAY_MS = 24 * 60 * 60 * 1000;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin;
}

const rangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const snapshotSelect =
  "order_id, customer_total, restaurant_gross, restaurant_net, platform_fee, platform_revenue, realized_platform_revenue, gateway_fee, service_fee_payer, coupon_discount, cashback, loyalty_discount";

function resolveRange(from?: string, to?: string) {
  return resolveAdminDateRangeUTC(from, to);
}

async function loadSnapshotsForOrders(sb: any, orderIds: string[]) {
  const { data, error } = await sb
    .from("order_pricing_snapshot")
    .select(snapshotSelect)
    .in("order_id", orderIds.length ? orderIds : [EMPTY_UUID]);
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminSnapshotMetricRow[];
}

export const getSuperadminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await assertAdmin(context.userId);
    const { fromDate, toDate } = resolveRange(data.from, data.to);

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1);
    const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      restaurantsAll,
      customersAll,
      ordersRange,
      ordersToday,
      ordersYesterday,
      ordersMonth,
      customersNew,
    ] = await Promise.all([
      sb.from("restaurants").select("id, active, is_open, created_at"),
      sb.from("customer_profiles").select("id, created_at"),
      sb.from("orders").select("id, restaurant_id, status, created_at, payment_method, items")
        .gte("created_at", fromDate.toISOString()).lte("created_at", toDate.toISOString()),
      sb.from("orders").select("id").gte("created_at", todayStart.toISOString()).lte("created_at", todayEnd.toISOString()),
      sb.from("orders").select("id").gte("created_at", yesterdayStart.toISOString()).lte("created_at", yesterdayEnd.toISOString()),
      sb.from("orders").select("id").gte("created_at", monthStart.toISOString()).lte("created_at", todayEnd.toISOString()),
      sb.from("customer_profiles").select("id").gte("created_at", fromDate.toISOString()),
    ]);

    if (ordersRange.error) throw new Error(ordersRange.error.message);

    const orders = (ordersRange.data ?? []) as AdminOrderMetricRow[];
    const snapshots = await loadSnapshotsForOrders(sb, orders.map((order) => order.id));
    const snapshotsByOrder = snapshotByOrderId(snapshots);
    const snapshotTotals = sumSnapshots(snapshots);

    const restaurants = restaurantsAll.data ?? [];
    const active = restaurants.filter((r) => r.active !== false).length;
    const inactive = restaurants.length - active;

    const hourly = Array.from({ length: 24 }, (_, h) => ({ h: `${h}h`, count: 0, revenue: 0 }));
    orders.forEach((order) => {
      const hour = new Date(order.created_at).getUTCHours();
      hourly[hour].count += 1;
      hourly[hour].revenue += money(snapshotsByOrder.get(order.id)?.customer_total) ?? 0;
    });

    const pmMap = new Map<string, number>();
    orders.forEach((order) => {
      const key = order.payment_method || "outros";
      pmMap.set(key, (pmMap.get(key) ?? 0) + 1);
    });

    const itemMap = new Map<string, number>();
    orders.forEach((order) => {
      const items = Array.isArray(order.items) ? (order.items as any[]) : [];
      items.forEach((item) => {
        const name = String(item?.name ?? "Item");
        itemMap.set(name, (itemMap.get(name) ?? 0) + Number(item?.qty ?? 1));
      });
    });

    const sumCustomerTotalForWindow = (start: Date, end: Date) =>
      orders
        .filter((order) => {
          const createdAt = new Date(order.created_at);
          return createdAt >= start && createdAt <= end;
        })
        .reduce((sum, order) => sum + (money(snapshotsByOrder.get(order.id)?.customer_total) ?? 0), 0);

    const todayRev = sumCustomerTotalForWindow(todayStart, todayEnd);
    const ydayRev = sumCustomerTotalForWindow(yesterdayStart, yesterdayEnd);
    const dailyGrowth = ydayRev ? ((todayRev - ydayRev) / ydayRev) * 100 : 0;

    return {
      ordersToday: (ordersToday.data ?? []).length,
      ordersMonth: (ordersMonth.data ?? []).length,
      todayRev,
      monthRev: sumCustomerTotalForWindow(monthStart, todayEnd),
      gmv: snapshotTotals.customerTotal,
      platformFee: snapshotTotals.platformFee,
      platformRevenue: snapshotTotals.platformRevenue,
      realizedPlatformRevenue: snapshotTotals.realizedPlatformRevenue,
      gatewayFee: snapshotTotals.gatewayFee,
      restaurantGross: snapshotTotals.restaurantGross,
      restaurantNet: snapshotTotals.restaurantNet,
      avgTicket: snapshotTotals.orders ? snapshotTotals.customerTotal / snapshotTotals.orders : 0,
      ordersWithSnapshot: snapshotTotals.orders,
      missingSnapshotOrders: orders.length - snapshotTotals.orders,
      restaurantsActive: active,
      restaurantsInactive: inactive,
      customersTotal: (customersAll.data ?? []).length,
      customersNew: (customersNew.data ?? []).length,
      dailyGrowth,
      hourly,
      dailyRevenue: buildAdminDailyRevenue(orders, snapshots),
      paymentMethods: Array.from(pmMap.entries()).map(([name, value]) => ({ name, value })),
      topItems: Array.from(itemMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([name, qty]) => ({ name, qty })),
    };
  });

export const getPlatformFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await assertAdmin(context.userId);
    const { fromDate, toDate } = resolveRange(data.from, data.to);

    const [restaurantsQ, ordersQ] = await Promise.all([
      sb.from("restaurants").select("id, name, category, city"),
      sb.from("orders").select("id, restaurant_id, status, created_at")
        .gte("created_at", fromDate.toISOString()).lte("created_at", toDate.toISOString()),
    ]);

    if (ordersQ.error) throw new Error(ordersQ.error.message);

    const restaurants = (restaurantsQ.data ?? []) as AdminRestaurantMetricRow[];
    const orders = (ordersQ.data ?? []) as AdminOrderMetricRow[];
    const snapshots = await loadSnapshotsForOrders(sb, orders.map((order) => order.id));
    const rows = buildAdminFinanceByRestaurant(restaurants, orders, snapshots);

    const totals = rows.reduce((acc, row) => ({
      orders: acc.orders + row.orders,
      ordersWithSnapshot: acc.ordersWithSnapshot + row.ordersWithSnapshot,
      customerTotal: acc.customerTotal + row.customerTotal,
      restaurantGross: acc.restaurantGross + row.restaurantGross,
      restaurantNet: acc.restaurantNet + row.restaurantNet,
      platformFee: acc.platformFee + row.platformFee,
      platformRevenue: acc.platformRevenue + row.platformRevenue,
      realizedPlatformRevenue: acc.realizedPlatformRevenue + row.realizedPlatformRevenue,
      gatewayFee: acc.gatewayFee + row.gatewayFee,
      missingSnapshotOrders: acc.missingSnapshotOrders + row.missingSnapshotOrders,
    }), {
      orders: 0,
      ordersWithSnapshot: 0,
      customerTotal: 0,
      restaurantGross: 0,
      restaurantNet: 0,
      platformFee: 0,
      platformRevenue: 0,
      realizedPlatformRevenue: 0,
      gatewayFee: 0,
      missingSnapshotOrders: 0,
    });

    return { rows, totals };
  });

export const listAdminPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await assertAdmin(context.userId);
    const { data } = await sb.from("restaurants")
      .select("id, name, category, city, whatsapp_phone, is_open, active, created_at")
      .order("created_at", { ascending: false });
    const { data: orders } = await sb.from("orders").select("restaurant_id, total");
    const stats = new Map<string, { count: number; gross: number }>();
    (orders ?? []).forEach((order) => {
      const key = order.restaurant_id as string;
      const current = stats.get(key) ?? { count: 0, gross: 0 };
      current.count += 1;
      current.gross += Number(order.total ?? 0);
      stats.set(key, current);
    });
    return (data ?? []).map((restaurant) => {
      const stat = stats.get(restaurant.id) ?? { count: 0, gross: 0 };
      return {
        ...restaurant,
        orders: stat.count,
        gross: stat.gross,
        commission: null,
      };
    });
  });

export const listAdminCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await assertAdmin(context.userId);
    const { data } = await sb.from("customer_profiles")
      .select("id, full_name, email, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = (data ?? []).map((customer) => customer.id);
    const { data: orders } = await sb.from("orders")
      .select("customer_id, total, created_at")
      .in("customer_id", ids.length ? ids : [EMPTY_UUID]);
    const stats = new Map<string, { count: number; spent: number; last: string | null }>();
    (orders ?? []).forEach((order) => {
      const key = order.customer_id as string;
      const current = stats.get(key) ?? { count: 0, spent: 0, last: null };
      current.count += 1;
      current.spent += Number(order.total ?? 0);
      const createdAt = order.created_at as string;
      if (!current.last || createdAt > current.last) current.last = createdAt;
      stats.set(key, current);
    });
    return (data ?? []).map((customer) => {
      const stat = stats.get(customer.id) ?? { count: 0, spent: 0, last: null };
      return { ...customer, orders: stat.count, spent: stat.spent, last_order_at: stat.last };
    });
  });

export const listAdminTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    payment: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await assertAdmin(context.userId);
    const { fromDate, toDate } = resolveRange(data.from, data.to);
    let query = sb.from("orders")
      .select("id, order_number, payment_method, status, created_at, restaurant_id, customer_name")
      .gte("created_at", fromDate.toISOString()).lte("created_at", toDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.payment && data.payment !== "all") query = query.eq("payment_method", data.payment);

    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);

    const orderRows = (orders ?? []) as Array<AdminOrderMetricRow & {
      order_number: number | null;
      customer_name: string | null;
    }>;
    const restIds = Array.from(new Set(orderRows.map((order) => order.restaurant_id).filter(Boolean)));
    const [restsQ, snapshots] = await Promise.all([
      sb.from("restaurants").select("id, name").in("id", restIds.length ? restIds : [EMPTY_UUID]),
      loadSnapshotsForOrders(sb, orderRows.map((order) => order.id)),
    ]);

    const restaurantNameById = new Map((restsQ.data ?? []).map((restaurant) => [restaurant.id, restaurant.name]));
    const snapshotsByOrder = snapshotByOrderId(snapshots);

    return orderRows.map((order) => {
      const snapshot = snapshotsByOrder.get(order.id);
      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        payment_method: order.payment_method,
        customer_name: order.customer_name,
        restaurant_name: restaurantNameById.get(order.restaurant_id as string) ?? "-",
        financialSnapshotAvailable: Boolean(snapshot),
        gross: money(snapshot?.customer_total),
        restaurant_gross: money(snapshot?.restaurant_gross),
        fee: money(snapshot?.platform_fee),
        platform_revenue: money(snapshot?.platform_revenue),
        realized_platform_revenue: money(snapshot?.realized_platform_revenue),
        gateway_fee: money(snapshot?.gateway_fee),
        net: money(snapshot?.restaurant_net),
      };
    });
  });

export const setPartnerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await assertAdmin(context.userId);
    const { error } = await sb.from("restaurants").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await assertAdmin(context.userId);
    const { error } = await sb.from("restaurants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
