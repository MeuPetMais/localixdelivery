import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  restaurantId: z.string().uuid(),
  period: z.number().int().min(1).max(365).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

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

    // Janela do filtro selecionado (from/to em YYYY-MM-DD inclusivos, senão fallback para period=30)
    const fromDate = data.from
      ? new Date(`${data.from}T00:00:00`)
      : new Date(startToday.getTime() - ((data.period ?? 30) - 1) * DAY);
    const toDate = data.to
      ? new Date(`${data.to}T23:59:59.999`)
      : now;
    const periodDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / DAY) + 1);
    const period = periodDays;
    const sincePeriod = fromDate;
    const lookback = Math.max(60, periodDays) * DAY;
    const sinceFetch = new Date(Math.min(fromDate.getTime(), now.getTime() - lookback));


    const [{ data: orders }, { data: customers }, { data: items }, { data: movements }, { data: coupons }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, total, items, status, created_at, customer_phone, customer_name, discount")
        .eq("restaurant_id", data.restaurantId)
        .gte("created_at", sinceFetch.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("customers")
        .select("id, name, phone, total_orders, total_spent, last_order_at, created_at")
        .eq("restaurant_id", data.restaurantId),
      supabaseAdmin
        .from("menu_items")
        .select("id, name, price, image_url, created_at")
        .eq("restaurant_id", data.restaurantId),
      supabaseAdmin
        .from("financial_movements")
        .select("id, type, category, description, amount, movement_date, created_at")
        .eq("restaurant_id", data.restaurantId)
        .gte("movement_date", sincePeriod.toISOString().slice(0, 10)),
      supabaseAdmin
        .from("coupons")
        .select("id, code, discount_percent, uses_count, is_active, created_at")
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

    // Period series (respects selected window [fromDate..toDate])
    const series: { date: string; revenue: number; orders: number }[] = [];
    const stepDays = periodDays <= 7 ? 1 : periodDays <= 30 ? 1 : 3;
    const startBucket = new Date(fromDate);
    startBucket.setHours(0, 0, 0, 0);
    for (let t = startBucket.getTime(); t <= toDate.getTime(); t += stepDays * DAY) {
      const d = new Date(t);
      const next = new Date(t + stepDays * DAY);
      const slice = allOrders.filter((o) => {
        const ot = new Date(o.created_at);
        return ot >= d && ot < next;
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

    // Status breakdown across selected period (includes cancelled)
    const periodOrders = (orders ?? []).filter((o) => {
      const t = new Date(o.created_at);
      return t >= sincePeriod && t <= toDate;
    });
    const statusBreakdown = {
      novo: periodOrders.filter((o) => o.status === "novo" || o.status === "pendente").length,
      preparo: periodOrders.filter((o) => o.status === "em_preparo" || o.status === "preparando").length,
      entrega: periodOrders.filter((o) => o.status === "em_entrega" || o.status === "saiu_entrega").length,
      entregue: periodOrders.filter((o) => o.status === "entregue" || o.status === "concluido").length,
      cancelado: periodOrders.filter((o) => o.status === "cancelado").length,
    };

    // Top 5 products (within selected period)
    const last30 = allOrders.filter((o) => new Date(o.created_at) >= since30);
    const periodForTop = allOrders.filter((o) => new Date(o.created_at) >= sincePeriod);
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of periodForTop) {
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
    const menuByName = new Map((items ?? []).map((i) => [i.name, i]));
    const top = Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((p) => {
        const m = menuByName.get(p.name);
        const price = Number(m?.price ?? (p.qty ? p.revenue / p.qty : 0));
        const margin = price > 0 ? Math.round(((price - price * 0.35) / price) * 100) : 0;
        return { ...p, margin, image_url: (m?.image_url as string | null) ?? null };
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

    const productsActive = (items ?? []).length;

    // Inactive customers (no orders 30+ days)
    const inactive = cust.filter(
      (c) => c.last_order_at && Date.now() - new Date(c.last_order_at).getTime() >= 30 * DAY,
    ).length;
    const frequent = cust.filter((c) => (c.total_orders ?? 0) >= 3).length;

    // Financial summary (selected period)
    const mvs = movements ?? [];
    const grossRevenue = periodOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const expenses = mvs
      .filter((m) => m.type === "despesa" || m.type === "expense")
      .reduce((s, m) => s + Number(m.amount ?? 0), 0);
    const costs = mvs
      .filter((m) => m.type === "custo" || m.type === "cost" || m.category === "cmv")
      .reduce((s, m) => s + Number(m.amount ?? 0), 0);
    const estimatedCogs = costs > 0 ? costs : grossRevenue * 0.35;
    const netProfit = grossRevenue - estimatedCogs - expenses;

    // Loyalty summary
    const couponsUsed = (coupons ?? []).reduce((s, c) => s + Number(c.uses_count ?? 0), 0);
    const discountDistributed = periodOrders.reduce((s, o) => s + Number(o.discount ?? 0), 0);
    const pointsIssued = Math.floor(grossRevenue); // 1 ponto por R$1

    // Recent activities (timeline)
    type Activity = { type: string; label: string; detail: string; at: string };
    const activities: Activity[] = [];
    for (const o of (orders ?? []).slice(0, 8)) {
      const isDelivered = o.status === "entregue" || o.status === "concluido";
      activities.push({
        type: isDelivered ? "delivered" : "order",
        label: isDelivered ? "Pedido entregue" : "Novo pedido",
        detail: `${o.customer_name ?? "Cliente"} — ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(o.total ?? 0))}`,
        at: o.created_at as string,
      });
      if (Number(o.discount ?? 0) > 0) {
        activities.push({
          type: "coupon",
          label: "Cupom utilizado",
          detail: `Desconto de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(o.discount))}`,
          at: o.created_at as string,
        });
      }
    }
    for (const c of cust.slice(0, 5)) {
      if (c.created_at && new Date(c.created_at) >= new Date(now.getTime() - 7 * DAY)) {
        activities.push({
          type: "customer",
          label: "Cliente cadastrado",
          detail: c.name ?? c.phone ?? "Novo cliente",
          at: c.created_at as string,
        });
      }
    }
    for (const it of (items ?? []).slice(0, 5)) {
      if (it.created_at && new Date(it.created_at as string) >= new Date(now.getTime() - 7 * DAY)) {
        activities.push({
          type: "product",
          label: "Produto adicionado",
          detail: it.name as string,
          at: it.created_at as string,
        });
      }
    }
    activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const timeline = activities.slice(0, 10);

    // Daily AI tip (rule-based, deterministic per day)
    const tips: string[] = [];
    if (top[0]) tips.push(`🏆 Seu produto mais lucrativo é **${top[0].name}**. Destaque-o no topo do cardápio.`);
    const hourBuckets = new Array(24).fill(0);
    for (const o of last30) hourBuckets[new Date(o.created_at).getHours()]++;
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
    if (Math.max(...hourBuckets) > 0)
      tips.push(`⏰ Seu horário de pico é **${peakHour}h**. Programe uma campanha 1h antes para maximizar vendas.`);
    const topVip = [...cust].sort((a, b) => Number(b.total_spent ?? 0) - Number(a.total_spent ?? 0))[0];
    if (topVip && Number(topVip.total_spent ?? 0) > 0)
      tips.push(`💎 Seu cliente VIP é **${topVip.name ?? topVip.phone}** (${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(topVip.total_spent))} em compras). Envie um agrado exclusivo.`);
    if (vipInactive > 0)
      tips.push(`🔔 ${vipInactive} VIPs sem comprar há 15+ dias. Sugira uma campanha "Sentimos sua falta" com 10% off.`);
    if (tips.length === 0) tips.push("✨ Cadastre seus produtos e divulgue seu link para começar a receber dicas inteligentes.");
    const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const dailyTip = tips[dayIndex % tips.length];

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
        productsActive,
        productsDelta: 0,
      },
      series,
      funnel,
      statusBreakdown,
      topProducts: top,
      customerSegments: { new: newCust, recurring, vip, total: cust.length },
      crm: { vip, frequent, inactive, total: cust.length },
      financial: {
        grossRevenue,
        costs: estimatedCogs,
        expenses,
        netProfit,
      },
      loyalty: {
        pointsIssued,
        couponsUsed,
        cashbackDistributed: discountDistributed,
      },
      timeline,
      dailyTip,
      insights,
      period,
    };
  });
