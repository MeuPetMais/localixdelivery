import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DAY = 24 * 60 * 60 * 1000;

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  slug: z.string().min(2),
  category: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp_phone: z.string().optional(),
  manager_name: z.string().optional(),
  active: z.boolean().optional(),
});

export const listUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since30 = new Date(Date.now() - 30 * DAY).toISOString();

    const { data: units, error } = await supabase
      .from("restaurants")
      .select("id, name, slug, category, address, phone, whatsapp_phone, manager_name, active, is_open, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (units ?? []).map((u) => u.id);
    if (ids.length === 0) {
      return { units: [], consolidated: { revenue: 0, profit: 0, orders: 0, customers: 0 }, benchmark: null };
    }

    const [{ data: orders }, { data: customers }, { data: moves }] = await Promise.all([
      supabase.from("orders").select("restaurant_id, total, status, created_at").in("restaurant_id", ids).gte("created_at", since30).limit(5000),
      supabase.from("customers").select("restaurant_id, id").in("restaurant_id", ids),
      supabase.from("financial_movements").select("restaurant_id, type, amount").in("restaurant_id", ids).gte("movement_date", since30.slice(0, 10)),
    ]);

    const byUnit = new Map<string, { revenue: number; orders: number; profit: number; customers: number }>();
    for (const id of ids) byUnit.set(id, { revenue: 0, orders: 0, profit: 0, customers: 0 });

    for (const o of orders ?? []) {
      if (o.status === "cancelado") continue;
      const u = byUnit.get(o.restaurant_id);
      if (!u) continue;
      u.revenue += Number(o.total ?? 0);
      u.orders += 1;
    }
    for (const c of customers ?? []) {
      const u = byUnit.get(c.restaurant_id);
      if (u) u.customers += 1;
    }
    for (const m of moves ?? []) {
      const u = byUnit.get(m.restaurant_id);
      if (!u) continue;
      u.profit += (m.type === "receita" ? 1 : -1) * Number(m.amount ?? 0);
    }
    // Fallback: if no financial movements, approximate profit as 30% of revenue
    for (const [id, u] of byUnit) {
      if (u.profit === 0) u.profit = u.revenue * 0.3;
      byUnit.set(id, u);
    }

    const enriched = (units ?? []).map((u) => {
      const k = byUnit.get(u.id)!;
      const ticket = k.orders > 0 ? k.revenue / k.orders : 0;
      return { ...u, revenue: k.revenue, orders: k.orders, profit: k.profit, customers: k.customers, ticket };
    });

    const consolidated = enriched.reduce(
      (acc, u) => ({
        revenue: acc.revenue + u.revenue,
        profit: acc.profit + u.profit,
        orders: acc.orders + u.orders,
        customers: acc.customers + u.customers,
      }),
      { revenue: 0, profit: 0, orders: 0, customers: 0 },
    );

    // Benchmark anonimizado por categoria (média setor)
    const category = enriched[0]?.category ?? null;
    let benchmark: null | {
      category: string;
      avgTicket: number;
      peakHour: number;
      topProduct: string | null;
      sectorGrowth: number;
      sampleSize: number;
    } = null;

    if (category) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: peers } = await supabaseAdmin
        .from("restaurants")
        .select("id")
        .eq("category", category)
        .neq("owner_id", userId)
        .limit(200);
      const peerIds = (peers ?? []).map((p) => p.id);
      if (peerIds.length > 0) {
        const since60 = new Date(Date.now() - 60 * DAY).toISOString();
        const cutoff30 = new Date(Date.now() - 30 * DAY).getTime();
        const { data: peerOrders } = await supabaseAdmin
          .from("orders")
          .select("total, status, created_at, items")
          .in("restaurant_id", peerIds)
          .gte("created_at", since60)
          .limit(5000);
        const valid = (peerOrders ?? []).filter((o) => o.status !== "cancelado");
        const valid30 = valid.filter((o) => new Date(o.created_at).getTime() >= cutoff30);
        const validPrev = valid.filter((o) => new Date(o.created_at).getTime() < cutoff30);
        const sumRev = valid30.reduce((s, o) => s + Number(o.total ?? 0), 0);
        const sumPrev = validPrev.reduce((s, o) => s + Number(o.total ?? 0), 0);
        const avgTicket = valid30.length ? sumRev / valid30.length : 0;
        const sectorGrowth = sumPrev > 0 ? ((sumRev - sumPrev) / sumPrev) * 100 : 0;

        const hourCount = new Array(24).fill(0);
        const productCount = new Map<string, number>();
        for (const o of valid30) {
          hourCount[new Date(o.created_at).getHours()] += 1;
          const items = Array.isArray((o as { items?: unknown }).items) ? ((o as { items: Array<{ name?: string; quantity?: number }> }).items) : [];
          for (const it of items) {
            if (!it?.name) continue;
            productCount.set(it.name, (productCount.get(it.name) ?? 0) + Number(it.quantity ?? 1));
          }
        }
        const peakHour = hourCount.indexOf(Math.max(...hourCount));
        const topProduct = [...productCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        benchmark = { category, avgTicket, peakHour, topProduct, sectorGrowth, sampleSize: peerIds.length };
      }
    }

    return { units: enriched, consolidated, benchmark };
  });

export const upsertUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase.from("restaurants").update({
        name: data.name, slug: data.slug, category: data.category, address: data.address,
        phone: data.phone, whatsapp_phone: data.whatsapp_phone, manager_name: data.manager_name,
        active: data.active ?? true,
      }).eq("id", data.id).eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase.from("restaurants").insert({
      owner_id: userId, name: data.name, slug: data.slug, category: data.category,
      address: data.address, phone: data.phone, whatsapp_phone: data.whatsapp_phone ?? "",
      manager_name: data.manager_name, active: data.active ?? true,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const generateUnitsInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since30 = new Date(Date.now() - 30 * DAY).toISOString();
    const { data: units } = await supabase
      .from("restaurants").select("id, name, category").eq("owner_id", userId);
    if (!units?.length) return { insights: "Cadastre suas unidades para gerar insights." };

    const ids = units.map((u) => u.id);
    const { data: orders } = await supabase
      .from("orders").select("restaurant_id, total, status, created_at")
      .in("restaurant_id", ids).gte("created_at", since30).limit(5000);

    const stats = units.map((u) => {
      const valid = (orders ?? []).filter((o) => o.restaurant_id === u.id && o.status !== "cancelado");
      const rev = valid.reduce((s, o) => s + Number(o.total ?? 0), 0);
      return { name: u.name, revenue: rev, orders: valid.length, ticket: valid.length ? rev / valid.length : 0 };
    });
    const avgRev = stats.reduce((s, u) => s + u.revenue, 0) / Math.max(stats.length, 1);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { insights: "IA indisponível: configure LOVABLE_API_KEY." };

    const prompt = `Você é um consultor de redes de delivery. Analise as unidades abaixo (últimos 30 dias) e gere 4 insights curtos e acionáveis em português, comparando unidades entre si e indicando ações específicas. Use bullets.\n\nMédia da rede: R$ ${avgRev.toFixed(2)}\n\n${JSON.stringify(stats, null, 2)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de uso da IA atingido.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na IA (${res.status})`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { insights: json.choices?.[0]?.message?.content?.trim() ?? "" };
  });
