// RevenueAnalyticsService — leitura agregada da receita da plataforma.
// Fonte: order_pricing_snapshot (imutável, uma linha por pedido).
import { supabase } from "@/integrations/supabase/client";

export interface RevenueSummary {
  totalRevenue: number;
  orders: number;
  avgPerOrder: number;
  currency: string;
}

async function sumRange(fromISO: string): Promise<RevenueSummary> {
  const { data } = await supabase
    .from("order_pricing_snapshot" as any)
    .select("platform_revenue, currency, created_at")
    .gte("created_at", fromISO);
  const rows = (data ?? []) as unknown as Array<{ platform_revenue: number; currency: string }>;
  const totalRevenue = rows.reduce((s, r) => s + Number(r.platform_revenue || 0), 0);
  const orders = rows.length;
  const avgPerOrder = orders > 0 ? totalRevenue / orders : 0;
  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    orders,
    avgPerOrder: Math.round(avgPerOrder * 100) / 100,
    currency: rows[0]?.currency ?? "BRL",
  };
}

export const RevenueAnalyticsService = {
  daily: () => sumRange(new Date(Date.now() - 86400_000).toISOString()),
  monthly: () => sumRange(new Date(Date.now() - 30 * 86400_000).toISOString()),
  yearly: () => sumRange(new Date(Date.now() - 365 * 86400_000).toISOString()),
  async byRestaurant(restaurantId: string, days = 30): Promise<RevenueSummary> {
    const fromISO = new Date(Date.now() - days * 86400_000).toISOString();
    const { data } = await supabase
      .from("order_pricing_snapshot" as any)
      .select("platform_revenue, currency, orders!inner(restaurant_id)")
      .eq("orders.restaurant_id", restaurantId)
      .gte("created_at", fromISO);
    const rows = (data ?? []) as unknown as Array<{ platform_revenue: number; currency: string }>;
    const totalRevenue = rows.reduce((s, r) => s + Number(r.platform_revenue || 0), 0);
    const orders = rows.length;
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      orders,
      avgPerOrder: orders > 0 ? Math.round((totalRevenue / orders) * 100) / 100 : 0,
      currency: rows[0]?.currency ?? "BRL",
    };
  },
};
