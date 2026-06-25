import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const chatSchema = z.object({
  restaurantId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(30),
});

const DAY = 24 * 60 * 60 * 1000;

async function buildContext(restaurantId: string, ownerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rest } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, owner_id, category")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!rest) throw new Error("Restaurante não encontrado");
  if (rest.owner_id !== ownerId) throw new Error("Forbidden");

  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [
    { data: orders },
    { data: customers },
    { data: items },
    { data: coupons },
    { data: ingredients },
    { data: finance },
  ] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, total, items, status, created_at")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since30)
      .limit(1000),
    supabaseAdmin
      .from("customers")
      .select("id, total_orders, total_spent, avg_ticket, last_order_at")
      .eq("restaurant_id", restaurantId),
    supabaseAdmin
      .from("menu_items")
      .select("id, name, price, is_available")
      .eq("restaurant_id", restaurantId),
    supabaseAdmin
      .from("coupons")
      .select("code, discount_percent, is_active, valid_until")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),
    supabaseAdmin
      .from("ingredients")
      .select("name, current_stock, min_stock, unit, cost_per_unit")
      .eq("restaurant_id", restaurantId),
    supabaseAdmin
      .from("financial_movements")
      .select("type, amount, created_at")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since30),
  ]);

  const ords = orders ?? [];
  const validOrders = ords.filter((o: any) => o.status !== "cancelado");
  const revenue = validOrders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
  const ticket = validOrders.length ? revenue / validOrders.length : 0;

  // hour buckets
  const hours = new Array(24).fill(0);
  for (const o of validOrders) {
    const h = new Date(o.created_at).getHours();
    hours[h] += 1;
  }
  const peakHour = hours.indexOf(Math.max(...hours));

  // top items
  const tally = new Map<string, { qty: number; revenue: number }>();
  for (const o of validOrders) {
    const its = (o.items as any[]) ?? [];
    if (!Array.isArray(its)) continue;
    for (const it of its) {
      if (!it?.name) continue;
      const cur = tally.get(it.name) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity ?? it.qty ?? 1);
      cur.revenue += Number(it.price ?? 0) * Number(it.quantity ?? it.qty ?? 1);
      tally.set(it.name, cur);
    }
  }
  const ranked = Array.from(tally.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty);

  const cutoff30 = new Date(now - 30 * DAY);
  const activeCustomers = (customers ?? []).filter((c: any) => c.last_order_at && new Date(c.last_order_at) >= cutoff30).length;
  const inactiveCustomers = (customers ?? []).length - activeCustomers;

  const lowStock = (ingredients ?? []).filter((i: any) => Number(i.current_stock) <= Number(i.min_stock));

  const revenueFin = (finance ?? []).filter((m: any) => m.type === "revenue").reduce((s: number, m: any) => s + Number(m.amount), 0);
  const expenses = (finance ?? []).filter((m: any) => m.type === "expense").reduce((s: number, m: any) => s + Number(m.amount), 0);

  return {
    name: rest.name,
    category: rest.category ?? "—",
    revenue30: revenue,
    orders30: validOrders.length,
    ticket30: ticket,
    peakHour,
    hourDistribution: hours,
    topProducts: ranked.slice(0, 5),
    worstProducts: ranked.slice(-3).reverse(),
    totalCustomers: (customers ?? []).length,
    activeCustomers,
    inactiveCustomers,
    menuSize: (items ?? []).length,
    unavailableItems: (items ?? []).filter((i: any) => !i.is_available).length,
    activeCoupons: (coupons ?? []).length,
    lowStockItems: lowStock.map((i: any) => i.name).slice(0, 8),
    finance: { revenueRegistered: revenueFin, expenses, balance: revenueFin - expenses },
  };
}

export const consultorChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => chatSchema.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await buildContext(data.restaurantId, context.userId);

    const system = `Você é o "Consultor IA" do Localix Delivery, um consultor de negócios sênior especializado em restaurantes, pizzarias e lanchonetes. Sua missão é responder perguntas do dono do restaurante com base nos dados reais abaixo. Seja direto, prático e use português brasileiro. Cite números quando relevante. Se a pergunta não puder ser respondida com os dados, sugira o que falta medir.

DADOS DO RESTAURANTE "${ctx.name}" (categoria: ${ctx.category}) — últimos 30 dias:
- Receita: R$ ${ctx.revenue30.toFixed(2)} em ${ctx.orders30} pedidos · Ticket médio: R$ ${ctx.ticket30.toFixed(2)}
- Horário de pico: ${ctx.peakHour}h (distribuição por hora: ${ctx.hourDistribution.join(",")})
- Clientes: ${ctx.totalCustomers} total · ${ctx.activeCustomers} ativos · ${ctx.inactiveCustomers} inativos (30+ dias)
- Cardápio: ${ctx.menuSize} itens (${ctx.unavailableItems} indisponíveis)
- Cupons ativos: ${ctx.activeCoupons}
- Top produtos: ${ctx.topProducts.map((p) => `${p.name} (${p.qty}un, R$${p.revenue.toFixed(2)})`).join(" · ") || "—"}
- Produtos fracos: ${ctx.worstProducts.map((p) => `${p.name} (${p.qty}un)`).join(" · ") || "—"}
- Estoque crítico: ${ctx.lowStockItems.join(", ") || "tudo ok"}
- Financeiro registrado: Receita R$${ctx.finance.revenueRegistered.toFixed(2)} · Despesas R$${ctx.finance.expenses.toFixed(2)} · Saldo R$${ctx.finance.balance.toFixed(2)}

REGRAS:
- Respostas curtas (no máximo 5 parágrafos curtos ou uma lista de até 6 bullets).
- Sempre que possível, dê uma recomendação acionável ("comece por isso hoje").
- Não invente dados que não estão acima.`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
      throw new Error(`Falha na IA (${res.status})`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "Não consegui gerar resposta agora.";
    return { reply };
  });

export const getMyRestaurantId = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("restaurants")
      .select("id, name")
      .eq("owner_id", context.userId)
      .maybeSingle();
    return data;
  });
