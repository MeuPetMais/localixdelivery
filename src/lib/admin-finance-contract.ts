const DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_TIME_ZONE = "America/Sao_Paulo";

export type AdminRangePreset = "today" | "week" | "month" | "year" | "30d";

export type AdminOrderMetricRow = {
  id: string;
  restaurant_id: string | null;
  status: string | null;
  created_at: string;
  payment_method?: string | null;
  items?: unknown;
};

export type AdminSnapshotMetricRow = {
  order_id: string;
  customer_total?: number | string | null;
  restaurant_gross?: number | string | null;
  restaurant_net?: number | string | null;
  platform_fee?: number | string | null;
  platform_revenue?: number | string | null;
  realized_platform_revenue?: number | string | null;
  gateway_fee?: number | string | null;
  service_fee_payer?: string | null;
  coupon_discount?: number | string | null;
  cashback?: number | string | null;
  loyalty_discount?: number | string | null;
};

export type AdminRestaurantMetricRow = {
  id: string;
  name: string | null;
  category?: string | null;
  city?: string | null;
};

export function dateOnlyUTC(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const adminDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ADMIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const adminDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ADMIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function datePartsInAdminTimeZone(date: Date) {
  const parts = Object.fromEntries(
    adminDateTimeFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetForAdminTimeZone(date: Date) {
  const parts = datePartsInAdminTimeZone(date);
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

function adminLocalDateTimeToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
) {
  const localAsUTC = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let utc = new Date(localAsUTC - offsetForAdminTimeZone(new Date(localAsUTC)));
  utc = new Date(localAsUTC - offsetForAdminTimeZone(utc));
  return utc;
}

function dateOnlyInAdminTimeZone(date: Date) {
  const parts = Object.fromEntries(
    adminDateFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseDateOnlyInAdminTimeZone(value: string, endOfDay: boolean) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  const [, y, m, d] = match;
  return adminLocalDateTimeToUTC(
    Number(y),
    Number(m),
    Number(d),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
}

export function resolveAdminDateRangeUTC(from?: string, to?: string, now = new Date()) {
  const toDate = to ? parseDateOnlyInAdminTimeZone(to, true) : now;
  const fromDate = from ? parseDateOnlyInAdminTimeZone(from, false) : new Date(now.getTime() - 30 * DAY_MS);
  return { fromDate, toDate };
}

export function adminPresetRangeUTC(preset: AdminRangePreset, now = new Date()) {
  const end = dateOnlyInAdminTimeZone(now);
  const [year, month, day] = end.split("-").map(Number);
  let start = new Date(Date.UTC(year, month - 1, day));

  if (preset === "week") start = new Date(start.getTime() - 6 * DAY_MS);
  if (preset === "30d") start = new Date(start.getTime() - 29 * DAY_MS);
  if (preset === "month") start = new Date(Date.UTC(year, month - 1, 1));
  if (preset === "year") start = new Date(Date.UTC(year, 0, 1));

  return { from: dateOnlyUTC(start), to: end };
}

export function money(value: number | string | null | undefined) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function snapshotByOrderId(snapshots: AdminSnapshotMetricRow[]) {
  const byId = new Map<string, AdminSnapshotMetricRow>();
  for (const snapshot of snapshots) {
    if (!byId.has(snapshot.order_id)) byId.set(snapshot.order_id, snapshot);
  }
  return byId;
}

export function sumSnapshots(snapshots: AdminSnapshotMetricRow[]) {
  return snapshots.reduce(
    (acc, snapshot) => ({
      orders: acc.orders + 1,
      customerTotal: acc.customerTotal + (money(snapshot.customer_total) ?? 0),
      restaurantGross: acc.restaurantGross + (money(snapshot.restaurant_gross) ?? 0),
      restaurantNet: acc.restaurantNet + (money(snapshot.restaurant_net) ?? 0),
      platformFee: acc.platformFee + (money(snapshot.platform_fee) ?? 0),
      platformRevenue: acc.platformRevenue + (money(snapshot.platform_revenue) ?? 0),
      realizedPlatformRevenue:
        acc.realizedPlatformRevenue + (money(snapshot.realized_platform_revenue) ?? 0),
      gatewayFee: acc.gatewayFee + (money(snapshot.gateway_fee) ?? 0),
    }),
    {
      orders: 0,
      customerTotal: 0,
      restaurantGross: 0,
      restaurantNet: 0,
      platformFee: 0,
      platformRevenue: 0,
      realizedPlatformRevenue: 0,
      gatewayFee: 0,
    },
  );
}

export function buildAdminFinanceByRestaurant(
  restaurants: AdminRestaurantMetricRow[],
  orders: AdminOrderMetricRow[],
  snapshots: AdminSnapshotMetricRow[],
) {
  const snapshotsByOrder = snapshotByOrderId(snapshots);

  return restaurants
    .map((restaurant) => {
      const restaurantOrders = orders.filter((order) => order.restaurant_id === restaurant.id);
      const restaurantSnapshots = restaurantOrders
        .map((order) => snapshotsByOrder.get(order.id))
        .filter(Boolean) as AdminSnapshotMetricRow[];
      const totals = sumSnapshots(restaurantSnapshots);

      return {
        id: restaurant.id,
        name: restaurant.name,
        category: restaurant.category,
        city: restaurant.city,
        orders: restaurantOrders.length,
        ordersWithSnapshot: totals.orders,
        customerTotal: totals.customerTotal,
        restaurantGross: totals.restaurantGross,
        restaurantNet: totals.restaurantNet,
        platformFee: totals.platformFee,
        platformRevenue: totals.platformRevenue,
        realizedPlatformRevenue: totals.realizedPlatformRevenue,
        gatewayFee: totals.gatewayFee,
        missingSnapshotOrders: restaurantOrders.length - totals.orders,
      };
    })
    .filter((row) => row.orders > 0)
    .sort((a, b) => b.customerTotal - a.customerTotal);
}

export function buildAdminDailyRevenue(
  orders: AdminOrderMetricRow[],
  snapshots: AdminSnapshotMetricRow[],
) {
  const snapshotsByOrder = snapshotByOrderId(snapshots);
  const dayMap = new Map<string, number>();

  for (const order of orders) {
    const snapshot = snapshotsByOrder.get(order.id);
    if (!snapshot) continue;
    const key = dateOnlyInAdminTimeZone(new Date(order.created_at));
    dayMap.set(key, (dayMap.get(key) ?? 0) + (money(snapshot.customer_total) ?? 0));
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date: date.slice(5), revenue }));
}
