import { isOrderGrowthEligible } from "@/lib/orders/order-metrics-contract";

export type Customer360Order = {
  id: string;
  total: number | string | null;
  created_at: string;
  items: unknown;
  payment_method?: string | null;
  status?: string | null;
  coupon_id?: string | null;
};

export type Customer360Customer = {
  id: string;
  restaurant_id: string;
  name: string | null;
  phone: string;
  email: string | null;
  total_orders: number | null;
  total_spent: number | string | null;
  avg_ticket: number | string | null;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Customer360Lifecycle =
  | "NEW"
  | "AWAITING_SECOND_PURCHASE"
  | "RECURRING"
  | "HIGH_VALUE"
  | "LOYAL"
  | "AT_RISK"
  | "INACTIVE"
  | "REACTIVATED";

export type Customer360Metrics = {
  total_orders: number;
  total_spent: number;
  avg_ticket: number;
  first_order_at: string | null;
  last_order_at: string | null;
  days_since_last_order: number | null;
  avg_days_between_orders: number | null;
  frequency_per_30d: number;
  favorite_products: Array<{ product_id: string; name: string | null; qty: number }>;
  predominant_weekday_utc: number | null;
  predominant_hour_utc: number | null;
  coupon_usage_count: number;
  cancellations: number;
  refunds: number;
  chargebacks: number;
};

export type Customer360ReadModel = {
  customer: Customer360Customer;
  lifecycle: Customer360Lifecycle;
  metrics: Customer360Metrics;
  metric_time_basis: "UTC";
};

const DAY_MS = 86_400_000;

export const CUSTOMER360_THRESHOLDS = {
  awaitingSecondPurchaseDays: 30,
  atRiskDays: 45,
  inactiveDays: 90,
  highValueSpend: 500,
  loyalMinOrders: 5,
} as const;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeProductId(item: any): string {
  return String(item?.productId ?? item?.product_id ?? item?.id ?? "");
}

export function resolveCustomer360Lifecycle(
  metrics: Customer360Metrics,
  thresholds = CUSTOMER360_THRESHOLDS,
): Customer360Lifecycle {
  if (metrics.total_orders <= 0) {
    throw new Error("Customer 360 requires at least one realized purchase");
  }

  if (metrics.total_orders === 1) {
    if (
      metrics.days_since_last_order !== null &&
      metrics.days_since_last_order <= thresholds.awaitingSecondPurchaseDays
    ) {
      return "AWAITING_SECOND_PURCHASE";
    }
    return "NEW";
  }

  if (
    metrics.days_since_last_order !== null &&
    metrics.days_since_last_order >= thresholds.inactiveDays
  ) {
    return "INACTIVE";
  }

  if (
    metrics.days_since_last_order !== null &&
    metrics.days_since_last_order >= thresholds.atRiskDays
  ) {
    return "AT_RISK";
  }

  if (metrics.total_spent >= thresholds.highValueSpend) {
    return "HIGH_VALUE";
  }

  if (metrics.total_orders >= thresholds.loyalMinOrders) {
    return "LOYAL";
  }

  return "RECURRING";
}

export function buildCustomer360ReadModel(
  customer: Customer360Customer,
  orders: Customer360Order[],
  now = new Date(),
): Customer360ReadModel {
  const realized = orders
    .filter((order) => isOrderGrowthEligible(order.status))
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  if (realized.length === 0 || Number(customer.total_orders ?? 0) <= 0) {
    throw new Error("Customer 360 requires at least one realized purchase");
  }

  const firstOrderAt = realized[0]?.created_at ?? null;
  const lastOrderAt = realized[realized.length - 1]?.created_at ?? null;
  const daysSinceLastOrder = lastOrderAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / DAY_MS))
    : null;

  const gaps: number[] = [];
  for (let i = 1; i < realized.length; i++) {
    const previous = new Date(realized[i - 1].created_at).getTime();
    const current = new Date(realized[i].created_at).getTime();
    gaps.push((current - previous) / DAY_MS);
  }
  const avgDaysBetweenOrders = gaps.length
    ? Math.round((gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) * 100) / 100
    : null;

  const productMap = new Map<string, { name: string | null; qty: number }>();
  const weekdayMap = new Map<number, number>();
  const hourMap = new Map<number, number>();

  let couponUsageCount = 0;

  for (const order of realized) {
    if (order.coupon_id) couponUsageCount += 1;

    const date = new Date(order.created_at);
    weekdayMap.set(date.getUTCDay(), (weekdayMap.get(date.getUTCDay()) ?? 0) + 1);
    hourMap.set(date.getUTCHours(), (hourMap.get(date.getUTCHours()) ?? 0) + 1);

    const items = Array.isArray(order.items) ? (order.items as any[]) : [];
    for (const item of items) {
      const productId = normalizeProductId(item);
      if (!productId) continue;
      const current = productMap.get(productId) ?? {
        name: item?.name ? String(item.name) : null,
        qty: 0,
      };
      current.qty += Number(item?.qty ?? item?.quantity ?? 1) || 0;
      if (!current.name && item?.name) current.name = String(item.name);
      productMap.set(productId, current);
    }
  }

  const totalOrders = Number(customer.total_orders ?? realized.length);
  const totalSpent = roundMoney(Number(customer.total_spent ?? 0));
  const avgTicket = roundMoney(Number(customer.avg_ticket ?? (totalOrders ? totalSpent / totalOrders : 0)));

  const tenureDays = firstOrderAt
    ? Math.max(1, (now.getTime() - new Date(firstOrderAt).getTime()) / DAY_MS)
    : 0;

  const metrics: Customer360Metrics = {
    total_orders: totalOrders,
    total_spent: totalSpent,
    avg_ticket: avgTicket,
    first_order_at: firstOrderAt,
    last_order_at: customer.last_order_at ?? lastOrderAt,
    days_since_last_order: daysSinceLastOrder,
    avg_days_between_orders: avgDaysBetweenOrders,
    frequency_per_30d: tenureDays > 0
      ? Math.round(((realized.length / tenureDays) * 30) * 100) / 100
      : 0,
    favorite_products: [...productMap.entries()]
      .map(([product_id, value]) => ({ product_id, ...value }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5),
    predominant_weekday_utc: [...weekdayMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    predominant_hour_utc: [...hourMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    coupon_usage_count: couponUsageCount,
    cancellations: orders.filter((order) => order.status === "cancelado").length,
    refunds: orders.filter((order) => order.status === "reembolsado").length,
    chargebacks: orders.filter((order) => order.status === "chargeback").length,
  };

  const lastGapDays = realized.length >= 2
    ? (new Date(realized[realized.length - 1].created_at).getTime() -
        new Date(realized[realized.length - 2].created_at).getTime()) / DAY_MS
    : 0;

  const lifecycle =
    lastGapDays >= CUSTOMER360_THRESHOLDS.inactiveDays &&
    metrics.days_since_last_order !== null &&
    metrics.days_since_last_order < CUSTOMER360_THRESHOLDS.atRiskDays
      ? "REACTIVATED"
      : resolveCustomer360Lifecycle(metrics);

  return {
    customer,
    lifecycle,
    metrics,
    metric_time_basis: "UTC",
  };
}

export function normalizeCustomerPhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}


export function resolveCustomer360LifecycleFromProjection(input: {
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  now?: Date;
}): Exclude<Customer360Lifecycle, "REACTIVATED"> {
  const now = input.now ?? new Date();
  if (input.totalOrders <= 0) {
    throw new Error("Customer 360 requires at least one realized purchase");
  }

  const daysSinceLastOrder = input.lastOrderAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(input.lastOrderAt).getTime()) / DAY_MS))
    : null;

  const metrics: Customer360Metrics = {
    total_orders: input.totalOrders,
    total_spent: input.totalSpent,
    avg_ticket: input.totalOrders ? input.totalSpent / input.totalOrders : 0,
    first_order_at: null,
    last_order_at: input.lastOrderAt,
    days_since_last_order: daysSinceLastOrder,
    avg_days_between_orders: null,
    frequency_per_30d: 0,
    favorite_products: [],
    predominant_weekday_utc: null,
    predominant_hour_utc: null,
    coupon_usage_count: 0,
    cancellations: 0,
    refunds: 0,
    chargebacks: 0,
  };

  return resolveCustomer360Lifecycle(metrics) as Exclude<Customer360Lifecycle, "REACTIVATED">;
}
