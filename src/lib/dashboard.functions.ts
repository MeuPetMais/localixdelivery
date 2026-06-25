import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ restaurantId: z.string().uuid() });

const DAY = 24 * 60 * 60 * 1000;

export const getDashboardData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("id, owner_id")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (!rest) throw new Error("Restaurante não encontrado");

    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startYesterday = new Date(startToday.getTime() - DAY);
    const since30 = new Date(now.getTime() - 30 * DAY);
    const since60 = new Date(now.getTime() - 60 * DAY);

    const [{ data: orders }, { data: customers }, { data: items }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, total, items, status, created_at, customer_phone")
        .eq("restaurant_id", data.restaurantId)
        .gte("created_at", since60.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000),
      supabaseAdmin
        .from("customers")
        .select("id, name, phone, total_orders, total_spent, last_order_at, created_at")
        .eq("restaurant_id", data.restaurantId),
      supabaseAdmin
        .from("menu_items")
        .select("id, name, price")
        .eq("restaurant_id", data.restaurantId),
    ]);

    const allOrders = (orders ?? []).filter((o) => o.status !== "cancelado");

    // KPIs today vs yesterday
    const todayOrders = allOrders.filter((o) => new Date(o.created_at) >= startToday);
    const yOrders = allOrders.filter((o) => {
      const t = new Date(o.created_at);
      return t >= startYesterday && t < startToday;
    });
    const sum = (a: typeof allOrders) => a.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const revToday = sum(todayOrders);
    const revY = sum(yOrders);
    const ticketToday = todayOrders.length ? revToday / todayOrders.length : 0;
    const ticketY = yOrders.length ? revY / yOrders.length : 0;

    const pct = (curr: number, prev: number) =>
      prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;

    // Active customers (30d) vs prev 30d
    const cust = customers ?? [];
    const activeNow = cust.filter((c) => c.last_order_at && new Date(c.last_order_at) >= since30).length;
    const activePrev = cust.filter((c) => {
      if (!c.last_order_at) return false;
      const d = new Date(c.last_order_at);
      return d >= since60 && d < since30;
    }).length;

    // 30d series
    const series: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(startToday.getTime() - i * DAY);
      const next = new Date(d.getTime() + DAY);
      const slice = allOrders.filter((o) => {
        const t = new Date(o.created_at);
        return t >= d && t < next;
      });
      series.push({
        date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        revenue: Math.round(sum(slice) * 100) / 100,
        orders: slice.length,
      });
    }

    // Funnel (live counts on open orders today + recent)
    const recent = (orders ?? []).filter((o) => new Date(o.created_at) >= new Date(now.getTime() - 3 * DAY));
    const funnel = {
      novo: recent.filter((o) => o.status === "novo" || o.status === "pendente").length,
      preparo: recent.filter((o) => o.status === "em_preparo" || o.status === "preparando").length,
      entrega: recent.filter((o) => o.status === "em_entrega" || o.status === "saiu_entrega").length,
      entregue: recent.filter((o) => o.status === "entregue" || o.status === "concluido").length,
    };

    // Top 5 products (last 30d)
    const last30 = allOrders.filter((o) => new Date(o.created_at) >= since30);
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of last30) {
      const its = (o.items as unknown as Array<{ name?: string; quantity?: number; price?: number }>) ?? [];
      if (!Array.isArray(its)) continue;
      for (const it of its) {
        if (!it?.name) continue;
        const cur = map.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
        cur.qty += Number(it.quantity ?? 1);
        cur.revenue += Number(it.price ?? 0) * Number(it.quantity ?? 1);
        map.set(it.name, cur);
      }
    }
    const menuPrice = new Map((items ?? []).map((i) => [i.name, Number(i.price)]));
    const top = Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((p) => {
        const price = menuPrice.get(p.name) ?? (p.qty ? p.revenue / p.qty : 0);
        // assume 35% cost baseline if unknown
        const margin = price > 0 ? Math.round(((price - price * 0.35) / price) * 100) : 0;
        return { ...p, margin };
      });

    // Customer segments
    const vipThreshold = 200;
    const newCust = cust.filter((c) => c.created_at && new Date(c.created_at) >= since30).length;
    const recurring = cust.filter((c) => (c.total_orders ?? 0) >= 2).length;
    const vip = cust.filter((c) => Number(c.total_spent ?? 0) >= vipThreshold).length;

    // Local insights (instant, no LLM)
    const insights: string[] = [];
    const ticketDelta30 = (() => {
      const c30 = last30;
      const cPrev = allOrders.filter((o) => {
        const t = new Date(o.created_at);
        return t >= since60 && t < since30;
      });
      const t30 = c30.length ? sum(c30) / c30.length : 0;
      const tPrev = cPrev.length ? sum(cPrev) / cPrev.length : 0;
      return tPrev ? ((t30 - tPrev) / tPrev) * 100 : 0;
    })();
    if (Math.abs(ticketDelta30) >= 5) {
      insights.push(
        `${ticketDelta30 >= 0 ? "📈" : "📉"} Seu ticket médio ${ticketDelta30 >= 0 ? "cresceu" : "caiu"} ${Math.abs(ticketDelta30).toFixed(1)}% nos últimos 30 dias.`,
      );
    }
    const vipInactive = cust.filter(
      (c) =>
        Number(c.total_spent ?? 0) >= vipThreshold &&
        c.last_order_at &&
        Date.now() - new Date(c.last_order_at).getTime() >= 15 * DAY,
    ).length;
    if (vipInactive > 0) {
      insights.push(`💎 ${vipInactive} cliente${vipInactive > 1 ? "s" : ""} VIP não compra${vipInactive > 1 ? "m" : ""} há 15+ dias. Considere uma campanha de recuperação.`);
    }
    if (top[0]) {
      insights.push(`🏆 Produto mais vendido: ${top[0].name} (${top[0].qty} un. em 30d).`);
    }
    if (funnel.novo >= 3) {
      insights.push(`⏱️ Você tem ${funnel.novo} pedidos novos aguardando confirmação.`);
    }
    if (insights.length === 0) {
      insights.push("✨ Cadastre seus produtos e compartilhe seu link para começar a receber pedidos.");
    }

    return {
      kpis: {
        ordersToday: todayOrders.length,
        ordersDelta: pct(todayOrders.length, yOrders.length),
        revenueToday: revToday,
        revenueDelta: pct(revToday, revY),
        ticketToday,
        ticketDelta: pct(ticketToday, ticketY),
        activeCustomers: activeNow,
        activeDelta: pct(activeNow, activePrev),
      },
      series,
      funnel,
      topProducts: top,
      customerSegments: { new: newCust, recurring, vip, total: cust.length },
      insights,
    };
  });
