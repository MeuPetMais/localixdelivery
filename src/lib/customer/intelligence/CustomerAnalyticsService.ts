import { supabase } from "@/integrations/supabase/client";
import type { CustomerAnalytics } from "./types";

type OrderRow = {
  id: string; total: number; created_at: string;
  items: unknown; payment_method?: string | null;
};

const DAY_MS = 86400000;

/**
 * CustomerAnalyticsService — pure aggregate calculations from raw orders.
 * Reuses `orders` table exclusively; never duplicates persisted counters from `customers`.
 */
export const CustomerAnalyticsService = {
  /** Compute analytics from a set of orders (pure). */
  compute(customerId: string, restaurantId: string, orders: OrderRow[]): CustomerAnalytics {
    const total_orders = orders.length;
    const total_spent = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const avg_ticket = total_orders ? total_spent / total_orders : 0;

    const sorted = [...orders].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    const first = sorted[0]?.created_at;
    const last = sorted[sorted.length - 1]?.created_at;
    const now = Date.now();
    const tenure_days = first ? Math.max(1, Math.round((now - +new Date(first)) / DAY_MS)) : 0;
    const days_since_last_order = last ? Math.round((now - +new Date(last)) / DAY_MS) : Number.POSITIVE_INFINITY;
    const months = Math.max(1, tenure_days / 30);
    const frequency_per_month = total_orders / months;

    const prodCount = new Map<string, { name?: string; qty: number }>();
    const catCount = new Map<string, { name?: string; qty: number }>();
    const channelCount = new Map<string, number>();

    for (const o of orders) {
      const ch = String(o.payment_method ?? "unknown");
      channelCount.set(ch, (channelCount.get(ch) ?? 0) + 1);
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      for (const it of items) {
        const pid = String(it?.id ?? it?.product_id ?? "");
        if (pid) {
          const cur = prodCount.get(pid) ?? { name: it?.name, qty: 0 };
          cur.qty += Number(it?.qty ?? it?.quantity ?? 1);
          cur.name = cur.name ?? it?.name;
          prodCount.set(pid, cur);
        }
        const cid = String(it?.category_id ?? "");
        if (cid) {
          const cur = catCount.get(cid) ?? { name: it?.category_name, qty: 0 };
          cur.qty += Number(it?.qty ?? it?.quantity ?? 1);
          catCount.set(cid, cur);
        }
      }
    }

    const favorite_products = [...prodCount.entries()]
      .map(([product_id, v]) => ({ product_id, name: v.name, qty: v.qty }))
      .sort((a, b) => b.qty - a.qty).slice(0, 5);
    const favorite_categories = [...catCount.entries()]
      .map(([category_id, v]) => ({ category_id, name: v.name, qty: v.qty }))
      .sort((a, b) => b.qty - a.qty).slice(0, 5);
    const favorite_channel = [...channelCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      customer_id: customerId,
      restaurant_id: restaurantId,
      total_orders,
      total_spent: Math.round(total_spent * 100) / 100,
      avg_ticket: Math.round(avg_ticket * 100) / 100,
      frequency_per_month: Math.round(frequency_per_month * 100) / 100,
      days_since_last_order: Number.isFinite(days_since_last_order) ? days_since_last_order : 9999,
      tenure_days,
      favorite_products,
      favorite_categories,
      favorite_channel,
    };
  },

  /** Fetch orders + compute. */
  async forCustomer(customerId: string, restaurantId: string, limit = 200): Promise<CustomerAnalytics> {
    const { data, error } = await (supabase as any)
      .from("orders")
      .select("id,total,created_at,items,payment_method")
      .eq("customer_id", customerId)
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return CustomerAnalyticsService.compute(customerId, restaurantId, (data ?? []) as OrderRow[]);
  },
} as const;
