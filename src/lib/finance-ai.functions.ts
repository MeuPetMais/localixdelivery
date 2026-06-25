import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  restaurantId: z.string().uuid(),
  taxRate: z.number().min(0).max(60).optional(),
});

const DAY = 24 * 60 * 60 * 1000;

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
    throw new Error(`Falha na IA (${res.status})`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export const getFinancialIntelligence = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, owner_id")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (!rest) throw new Error("Restaurante não encontrado");

    const now = Date.now();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const since60 = new Date(now - 60 * DAY).toISOString();

    const [{ data: orders }, { data: items }, { data: categories }, { data: ingredients }, { data: recipes }, { data: moves }] = await Promise.all([
      supabaseAdmin.from("orders").select("id, total, items, status, created_at").eq("restaurant_id", data.restaurantId).gte("created_at", since60).limit(2000),
      supabaseAdmin.from("menu_items").select("id, name, price, category_id").eq("restaurant_id", data.restaurantId),
      supabaseAdmin.from("menu_categories").select("id, name").eq("restaurant_id", data.restaurantId),
      supabaseAdmin.from("ingredients").select("id, name, stock, min_stock, unit_cost, updated_at").eq("restaurant_id", data.restaurantId),
      supabaseAdmin.from("recipe_items").select("menu_item_id, ingredient_id, quantity"),
      supabaseAdmin.from("financial_movements").select("type, amount, category, movement_date").eq("restaurant_id", data.restaurantId).gte("movement_date", since30.slice(0, 10)),
    ]);

    const cutoff30 = new Date(now - 30 * DAY);
    const validOrders30 = (orders ?? []).filter((o) => new Date(o.created_at) >= cutoff30 && o.status !== "cancelado");
    const validOrdersPrev = (orders ?? []).filter((o) => {
      const t = new Date(o.created_at);
      return t < cutoff30 && o.status !== "cancelado";
    });

    // Custo por produto via ficha técnica
    const ingMap = new Map((ingredients ?? []).map((i) => [i.id, i]));
    const catMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const costByItem = new Map<string, number>();
    for (const r of recipes ?? []) {
      const ing = ingMap.get(r.ingredient_id);
      if (!ing) continue;
      costByItem.set(r.menu_item_id, (costByItem.get(r.menu_item_id) ?? 0) + Number(r.quantity) * Number(ing.unit_cost));
    }

    // Vendas por produto (últimos 30d)
    const soldQty = new Map<string, number>();
    const revenueByItem = new Map<string, number>();
    for (const o of validOrders30) {
      const arr = (o.items as unknown as Array<{ id?: string; name?: string; price?: number; qty?: number; quantity?: number }>) ?? [];
      if (!Array.isArray(arr)) continue;
      for (const it of arr) {
        const id = it.id ?? it.name ?? "";
        const q = Number(it.qty ?? it.quantity ?? 1);
        const p = Number(it.price ?? 0);
        if (!id) continue;
        soldQty.set(id, (soldQty.get(id) ?? 0) + q);
        revenueByItem.set(id, (revenueByItem.get(id) ?? 0) + q * p);
      }
    }

    const products = (items ?? []).map((it) => {
      const cost = costByItem.get(it.id) ?? 0;
      const price = Number(it.price);
      const gross = price - cost;
      const margin = price > 0 ? (gross / price) * 100 : 0;
      const qty = soldQty.get(it.id) ?? 0;
      const revenue = revenueByItem.get(it.id) ?? qty * price;
      const profit = gross * qty;
      return {
        id: it.id,
        name: it.name,
        category: catMap.get(it.category_id ?? "") ?? "—",
        price,
        cost,
        gross,
        margin,
        qty,
        revenue,
        profit,
      };
    });

    const revenue30 = validOrders30.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const revenuePrev = validOrdersPrev.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const ticket30 = validOrders30.length ? revenue30 / validOrders30.length : 0;

    // DRE — Custo dos Produtos = soma profit/cost real das vendas
    const cogs = products.reduce((s, p) => s + p.cost * p.qty, 0);
    const grossProfit = revenue30 - cogs;

    const opex = (moves ?? []).filter((m) => m.type === "expense").reduce((s, m) => s + Number(m.amount), 0);
    const extraRevenue = (moves ?? []).filter((m) => m.type === "income").reduce((s, m) => s + Number(m.amount), 0);
    const operatingProfit = grossProfit + extraRevenue - opex;
    const taxRate = data.taxRate ?? 6;
    const taxes = Math.max(0, operatingProfit) * (taxRate / 100);
    const netProfit = operatingProfit - taxes;

    // Categorias por lucro
    const catProfit = new Map<string, number>();
    for (const p of products) catProfit.set(p.category, (catProfit.get(p.category) ?? 0) + p.profit);
    const topCategory = [...catProfit.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    const productsSold = products.filter((p) => p.qty > 0);
    const mostProfitable = [...productsSold].sort((a, b) => b.profit - a.profit)[0] ?? null;
    const leastProfitable = [...productsSold].sort((a, b) => a.profit - b.profit)[0] ?? null;

    // Despesas: comparar com período anterior (movimentações 60d -> 30d)
    const opexPrev = 0; // sem histórico anterior calculado aqui
    const supplierDelta = opexPrev ? ((opex - opexPrev) / opexPrev) * 100 : null;

    // Estoque parado (sem update há 45d)
    const stale = (ingredients ?? []).filter((i) => {
      const days = (now - new Date(i.updated_at).getTime()) / DAY;
      return days > 45 && Number(i.stock) > 0;
    });

    const dre = {
      receitaBruta: revenue30,
      cogs,
      lucroBruto: grossProfit,
      despesasOperacionais: opex,
      outrasReceitas: extraRevenue,
      lucroOperacional: operatingProfit,
      impostos: taxes,
      taxRate,
      lucroLiquido: netProfit,
    };

    const executive = {
      revenue30,
      revenuePrev,
      revenueDelta: revenuePrev ? ((revenue30 - revenuePrev) / revenuePrev) * 100 : 0,
      netProfit,
      ticket30,
      mostProfitable,
      leastProfitable,
      topCategory: topCategory ? { name: topCategory[0], profit: topCategory[1] } : null,
    };

    // Insights via IA
    const lowMargin = products.filter((p) => p.qty > 0 && p.margin < 20).slice(0, 5);
    const profitShare = mostProfitable && grossProfit > 0 ? (mostProfitable.profit / grossProfit) * 100 : 0;

    const aiPrompt = `Restaurante "${rest.name}". Análise dos últimos 30 dias.
Receita bruta: R$ ${revenue30.toFixed(2)} (anterior R$ ${revenuePrev.toFixed(2)}).
COGS: R$ ${cogs.toFixed(2)}. Lucro bruto: R$ ${grossProfit.toFixed(2)}.
Despesas operacionais: R$ ${opex.toFixed(2)}. Lucro líquido: R$ ${netProfit.toFixed(2)}.
Ticket médio: R$ ${ticket30.toFixed(2)}.
Produto mais lucrativo: ${mostProfitable?.name ?? "—"} (R$ ${mostProfitable?.profit.toFixed(2) ?? 0}, ${profitShare.toFixed(0)}% do lucro bruto).
Produto menos lucrativo: ${leastProfitable?.name ?? "—"}.
Produtos com margem baixa (<20%): ${lowMargin.map((p) => `${p.name} (${p.margin.toFixed(0)}%)`).join(", ") || "nenhum"}.
Ingredientes parados há 45+ dias: ${stale.map((s) => s.name).join(", ") || "nenhum"}.
${supplierDelta !== null ? `Variação despesas: ${supplierDelta.toFixed(1)}%.` : ""}

Gere de 4 a 6 insights financeiros curtos (máx 160 caracteres cada), em português brasileiro, com emoji no início e recomendação prática. Apenas a lista, um por linha.`;

    let insights: string[] = [];
    try {
      const text = await callAI(
        "Você é um CFO virtual para restaurantes. Foque em margem, lucro, custos e ações práticas. Português brasileiro, direto.",
        aiPrompt,
      );
      insights = text.split("\n").map((l) => l.replace(/^[-•\d.\s]+/, "").trim()).filter((l) => l.length > 4).slice(0, 8);
    } catch (e) {
      insights = [];
    }

    return {
      products: products.sort((a, b) => b.profit - a.profit),
      dre,
      executive,
      insights,
      staleIngredients: stale.map((s) => ({ name: s.name, stock: Number(s.stock), updated_at: s.updated_at })),
    };
  });
