import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMarketplace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: suppliers }, { data: products }, { data: favs }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("active", true).order("name"),
      supabase.from("supplier_products").select("*").order("price"),
      supabase.from("supplier_favorites").select("supplier_id").eq("user_id", userId),
    ]);
    return {
      suppliers: suppliers ?? [],
      products: products ?? [],
      favoriteIds: (favs ?? []).map((f) => f.supplier_id),
    };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ supplierId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("supplier_favorites").select("id")
      .eq("user_id", userId).eq("supplier_id", data.supplierId).maybeSingle();
    if (existing) {
      await supabase.from("supplier_favorites").delete().eq("id", existing.id);
      return { favorited: false };
    }
    await supabase.from("supplier_favorites").insert({ user_id: userId, supplier_id: data.supplierId });
    return { favorited: true };
  });

export const requestQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    supplierId: z.string().uuid(),
    productName: z.string().min(2).max(120),
    quantity: z.number().positive(),
    unit: z.string().min(1).max(10),
    message: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quote_requests").insert({
      user_id: context.userId, supplier_id: data.supplierId,
      product_name: data.productName, quantity: data.quantity, unit: data.unit,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("quote_requests")
      .select("*, suppliers(name, phone, email)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const recordPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    supplierId: z.string().uuid(),
    productName: z.string().min(2),
    quantity: z.number().positive(),
    unit: z.string().min(1),
    unitPrice: z.number().nonnegative(),
    referencePrice: z.number().nonnegative().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const total = data.quantity * data.unitPrice;
    const { error } = await context.supabase.from("purchase_orders").insert({
      user_id: context.userId, supplier_id: data.supplierId,
      product_name: data.productName, quantity: data.quantity, unit: data.unit,
      unit_price: data.unitPrice, reference_price: data.referencePrice ?? null, total,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPurchasingDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: orders }, { count: favCount }] = await Promise.all([
      supabase.from("purchase_orders").select("total, unit_price, reference_price, quantity, supplier_id").eq("user_id", userId).limit(500),
      supabase.from("supplier_favorites").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const list = orders ?? [];
    const totalSpent = list.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const savings = list.reduce((s, o) => {
      const ref = Number(o.reference_price ?? 0);
      if (!ref) return s;
      return s + Math.max(0, (ref - Number(o.unit_price)) * Number(o.quantity));
    }, 0);
    return {
      totalSpent,
      savings,
      ordersCount: list.length,
      favoritesCount: favCount ?? 0,
    };
  });

export const generatePurchasingInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: ingredients }, { data: products }, { data: orders }] = await Promise.all([
      data.restaurantId
        ? supabase.from("ingredients").select("name, stock, min_stock, unit, unit_cost").eq("restaurant_id", data.restaurantId)
        : Promise.resolve({ data: [] as Array<{ name: string; stock: number; min_stock: number; unit: string; unit_cost: number }> }),
      supabase.from("supplier_products").select("name, category, price, unit, suppliers(name)").limit(200),
      supabase.from("purchase_orders").select("product_name, unit_price, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { insights: "IA indisponível: configure LOVABLE_API_KEY." };

    const payload = {
      estoque: (ingredients ?? []).map((i) => ({
        nome: i.name, atual: Number(i.stock), minimo: Number(i.min_stock), unidade: i.unit, custo_unit: Number(i.unit_cost),
      })),
      marketplace: (products ?? []).map((p) => ({
        produto: p.name, categoria: p.category, preco: Number(p.price), unidade: p.unit,
        fornecedor: (p as { suppliers?: { name?: string } | null }).suppliers?.name ?? null,
      })),
      historico: orders ?? [],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é o copiloto de compras de um restaurante. Gere 4 insights curtos, acionáveis, em português. Compare preços do marketplace com o custo atual dos ingredientes, alerte ingredientes próximos de acabar (estoque atual / consumo estimado), e sugira trocas de fornecedor com % de economia. Use bullets." },
          { role: "user", content: JSON.stringify(payload) },
        ],
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
