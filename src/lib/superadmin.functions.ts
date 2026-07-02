import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Modelo de receita da plataforma (padrão MVP): 5% de comissão + R$0,99 por pedido.
const COMMISSION_RATE = 0.05;
const FIXED_FEE = 0.99;

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

function resolveRange(from?: string, to?: string) {
  const now = new Date();
  const toDate = to ? new Date(`${to}T23:59:59.999`) : now;
  const fromDate = from
    ? new Date(`${from}T00:00:00`)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

export const getSuperadminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await assertAdmin(context.userId);
    const { fromDate, toDate } = resolveRange(data.from, data.to);

    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date(startToday.getFullYear(), startToday.getMonth(), 1);
    const startYesterday = new Date(startToday.getTime() - 86400000);

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
      sb.from("orders").select("total, status, created_at, payment_method, items")
        .gte("created_at", fromDate.toISOString()).lte("created_at", toDate.toISOString()),
      sb.from("orders").select("total, status").gte("created_at", startToday.toISOString()),
      sb.from("orders").select("total").gte("created_at", startYesterday.toISOString()).lt("created_at", startToday.toISOString()),
      sb.from("orders").select("total").gte("created_at", startMonth.toISOString()),
      sb.from("customer_profiles").select("id").gte("created_at", fromDate.toISOString()),
    ]);

    const orders = ordersRange.data ?? [];
    const gmv = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const commissionRevenue = gmv * COMMISSION_RATE;
    const fixedRevenue = orders.length * FIXED_FEE;
    const platformRevenue = commissionRevenue + fixedRevenue;
    const avgTicket = orders.length ? gmv / orders.length : 0;

    const restaurants = restaurantsAll.data ?? [];
    const active = restaurants.filter(r => r.active !== false).length;
    const inactive = restaurants.length - active;

    // pedidos por hora (últimas 24h dentro do range)
    const hourly = Array.from({ length: 24 }, (_, h) => ({ h: `${h}h`, count: 0, revenue: 0 }));
    orders.forEach(o => {
      const d = new Date(o.created_at as string);
      const hh = d.getHours();
      hourly[hh].count += 1;
      hourly[hh].revenue += Number(o.total ?? 0);
    });

    // faturamento por dia
    const dayMap = new Map<string, number>();
    orders.forEach(o => {
      const key = new Date(o.created_at as string).toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) ?? 0) + Number(o.total ?? 0));
    });
    const dailyRevenue = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date: date.slice(5), revenue }));

    // meios de pagamento
    const pmMap = new Map<string, number>();
    orders.forEach(o => {
      const k = (o.payment_method as string) || "outros";
      pmMap.set(k, (pmMap.get(k) ?? 0) + 1);
    });
    const paymentMethods = Array.from(pmMap.entries()).map(([name, value]) => ({ name, value }));

    // categorias/itens mais vendidos
    const itemMap = new Map<string, number>();
    orders.forEach(o => {
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      items.forEach(it => {
        const n = String(it?.name ?? "Item");
        itemMap.set(n, (itemMap.get(n) ?? 0) + Number(it?.qty ?? 1));
      });
    });
    const topItems = Array.from(itemMap.entries())
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([name, qty]) => ({ name, qty }));

    // crescimento
    const todayRev = (ordersToday.data ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
    const ydayRev = (ordersYesterday.data ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
    const monthRev = (ordersMonth.data ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
    const dailyGrowth = ydayRev ? ((todayRev - ydayRev) / ydayRev) * 100 : 0;

    return {
      ordersToday: (ordersToday.data ?? []).length,
      ordersMonth: (ordersMonth.data ?? []).length,
      todayRev, monthRev,
      gmv, commissionRevenue, fixedRevenue, platformRevenue, avgTicket,
      restaurantsActive: active, restaurantsInactive: inactive,
      customersTotal: (customersAll.data ?? []).length,
      customersNew: (customersNew.data ?? []).length,
      dailyGrowth,
      hourly, dailyRevenue, paymentMethods, topItems,
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
      sb.from("orders").select("restaurant_id, total, created_at, delivery_fee:total")
        .gte("created_at", fromDate.toISOString()).lte("created_at", toDate.toISOString()),
    ]);
    const restaurants = restaurantsQ.data ?? [];
    const orders = ordersQ.data ?? [];

    const rows = restaurants.map(r => {
      const rOrders = orders.filter(o => o.restaurant_id === r.id);
      const gross = rOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
      const commission = gross * COMMISSION_RATE;
      const fees = rOrders.length * FIXED_FEE;
      const platform = commission + fees;
      const partnerBalance = gross - platform;
      return {
        id: r.id, name: r.name, category: r.category, city: r.city,
        orders: rOrders.length, gross, commission, fees, platform, partnerBalance,
      };
    }).sort((a, b) => b.gross - a.gross);

    const totals = rows.reduce((acc, r) => ({
      orders: acc.orders + r.orders,
      gross: acc.gross + r.gross,
      commission: acc.commission + r.commission,
      fees: acc.fees + r.fees,
      platform: acc.platform + r.platform,
    }), { orders: 0, gross: 0, commission: 0, fees: 0, platform: 0 });

    return { rows, totals };
  });

export const listAdminPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await assertAdmin(context.userId);
    const { data: restaurants } = await sb.from("restaurants")
      .select("id, name, category, city, whatsapp_phone, is_open, active, created_at")
      .order("created_at", { ascending: false });
    const { data: orders } = await sb.from("orders").select("restaurant_id, total");
    const stats = new Map<string, { count: number; gross: number }>();
    (orders ?? []).forEach(o => {
      const k = o.restaurant_id as string;
      const s = stats.get(k) ?? { count: 0, gross: 0 };
      s.count += 1; s.gross += Number(o.total ?? 0);
      stats.set(k, s);
    });
    return (restaurants ?? []).map(r => {
      const s = stats.get(r.id) ?? { count: 0, gross: 0 };
      return {
        ...r,
        orders: s.count,
        gross: s.gross,
        commission: s.gross * COMMISSION_RATE + s.count * FIXED_FEE,
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
    const ids = (data ?? []).map(c => c.id);
    const { data: orders } = await sb.from("orders")
      .select("customer_id, total, created_at").in("customer_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const stats = new Map<string, { count: number; spent: number; last: string | null }>();
    (orders ?? []).forEach(o => {
      const k = o.customer_id as string;
      const s = stats.get(k) ?? { count: 0, spent: 0, last: null };
      s.count += 1; s.spent += Number(o.total ?? 0);
      const d = o.created_at as string;
      if (!s.last || d > s.last) s.last = d;
      stats.set(k, s);
    });
    return (data ?? []).map(c => {
      const s = stats.get(c.id) ?? { count: 0, spent: 0, last: null };
      return { ...c, orders: s.count, spent: s.spent, last_order_at: s.last };
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
    let q = sb.from("orders")
      .select("id, order_number, total, payment_method, status, created_at, restaurant_id, customer_name")
      .gte("created_at", fromDate.toISOString()).lte("created_at", toDate.toISOString())
      .order("created_at", { ascending: false }).limit(500);
    if (data.payment && data.payment !== "all") q = q.eq("payment_method", data.payment);
    const { data: orders } = await q;
    const restIds = Array.from(new Set((orders ?? []).map(o => o.restaurant_id)));
    const { data: rests } = await sb.from("restaurants").select("id, name")
      .in("id", restIds.length ? restIds : ["00000000-0000-0000-0000-000000000000"]);
    const rMap = new Map((rests ?? []).map(r => [r.id, r.name]));
    return (orders ?? []).map(o => {
      const gross = Number(o.total ?? 0);
      const fee = FIXED_FEE;
      const commission = gross * COMMISSION_RATE;
      return {
        id: o.id, order_number: o.order_number, status: o.status, created_at: o.created_at,
        payment_method: o.payment_method, customer_name: o.customer_name,
        restaurant_name: rMap.get(o.restaurant_id as string) ?? "—",
        gross, fee, commission, net: gross - fee - commission,
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
