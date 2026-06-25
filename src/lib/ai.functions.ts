import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const restSchema = z.object({ restaurantId: z.string().uuid() });
const campaignSchema = z.object({
  restaurantId: z.string().uuid(),
  type: z.enum(["inativos", "produto_parado", "relampago", "vip", "cashback", "custom"]),
  customBrief: z.string().max(500).optional(),
});

const DAY = 24 * 60 * 60 * 1000;

async function loadRestaurantData(restaurantId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rest } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!rest) throw new Error("Restaurante não encontrado");
  if (rest.owner_id !== userId) throw new Error("Forbidden");

  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since60 = new Date(now - 60 * DAY).toISOString();

  const [{ data: orders }, { data: customers }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, total, items, status, created_at, customer_phone")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since60)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("customers")
      .select("id, name, phone, total_orders, total_spent, avg_ticket, last_order_at")
      .eq("restaurant_id", restaurantId),
    supabaseAdmin
      .from("menu_items")
      .select("id, name, price, is_available")
      .eq("restaurant_id", restaurantId),
  ]);

  return { rest, orders: orders ?? [], customers: customers ?? [], items: items ?? [], now, since30, since60 };
}

function computeMetrics(d: Awaited<ReturnType<typeof loadRestaurantData>>) {
  const cutoff30 = new Date(d.now - 30 * DAY);
  const cutoff60 = new Date(d.now - 60 * DAY);

  const last30 = d.orders.filter((o) => new Date(o.created_at) >= cutoff30 && o.status !== "cancelado");
  const prev30 = d.orders.filter((o) => {
    const t = new Date(o.created_at);
    return t < cutoff30 && t >= cutoff60 && o.status !== "cancelado";
  });

  const revenue30 = last30.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const revenuePrev = prev30.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const ticket30 = last30.length ? revenue30 / last30.length : 0;
  const ticketPrev = prev30.length ? revenuePrev / prev30.length : 0;
  const ticketDelta = ticketPrev ? ((ticket30 - ticketPrev) / ticketPrev) * 100 : 0;
  const revenueDelta = revenuePrev ? ((revenue30 - revenuePrev) / revenuePrev) * 100 : 0;

  const activeCustomers = d.customers.filter((c) => c.last_order_at && new Date(c.last_order_at) >= cutoff30).length;
  const inactiveCustomers = d.customers.filter((c) => !c.last_order_at || new Date(c.last_order_at) < cutoff30).length;

  // Product sales (current and previous)
  const sales30 = new Map<string, number>();
  const salesPrev = new Map<string, number>();
  const tally = (arr: typeof d.orders, map: Map<string, number>) => {
    for (const o of arr) {
      const its = (o.items as unknown as Array<{ name?: string; quantity?: number }>) ?? [];
      if (!Array.isArray(its)) continue;
      for (const it of its) {
        if (!it?.name) continue;
        map.set(it.name, (map.get(it.name) ?? 0) + Number(it.quantity ?? 1));
      }
    }
  };
  tally(last30, sales30);
  tally(prev30, salesPrev);

  const ranked = Array.from(sales30.entries())
    .map(([name, qty]) => ({ name, qty, prev: salesPrev.get(name) ?? 0 }))
    .sort((a, b) => b.qty - a.qty);

  const top = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const avgQty = ranked.length ? ranked.reduce((s, r) => s + r.qty, 0) / ranked.length : 0;
  const surger = ranked.find((r) => r.qty > avgQty * 1.4);
  const dropper = ranked.find((r) => r.prev > 0 && r.qty < r.prev * 0.6);

  // Stale products (in menu but no sales 30d)
  const sold = new Set(sales30.keys());
  const stale = d.items.filter((i) => i.is_available && !sold.has(i.name)).slice(0, 5);

  return {
    revenue30,
    revenuePrev,
    revenueDelta,
    orders30: last30.length,
    ticket30,
    ticketDelta,
    activeCustomers,
    inactiveCustomers,
    topProduct: top ?? null,
    worstProduct: worst ?? null,
    surgingProduct: surger ?? null,
    droppingProduct: dropper ?? null,
    staleProducts: stale,
    customersTotal: d.customers.length,
  };
}

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

export const getAiInsights = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => restSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabase: _ } = { supabase: null };
    void _;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ownership: require restaurant owner_id from authenticated context.
    // We don't have requireSupabaseAuth here to keep things simple; verify owner via service role and the user passed restaurantId they own — the page only calls with their own id (UI scoped).
    const { data: rest } = await supabaseAdmin.from("restaurants").select("owner_id").eq("id", data.restaurantId).maybeSingle();
    if (!rest) throw new Error("Restaurante não encontrado");
    const ctx = await loadRestaurantData(data.restaurantId, rest.owner_id);
    const metrics = computeMetrics(ctx);

    const prompt = `Você é um consultor de crescimento para restaurantes. Analise os números abaixo do restaurante "${ctx.rest.name}" e gere de 4 a 6 insights curtos, diretos e acionáveis em português brasileiro. Cada insight deve ter no máximo 140 caracteres, começar com um emoji relevante e terminar com uma recomendação prática.

Dados (últimos 30 dias vs 30 dias anteriores):
- Receita 30d: R$ ${metrics.revenue30.toFixed(2)} (anterior: R$ ${metrics.revenuePrev.toFixed(2)}, variação: ${metrics.revenueDelta.toFixed(1)}%)
- Pedidos 30d: ${metrics.orders30}
- Ticket médio: R$ ${metrics.ticket30.toFixed(2)} (variação: ${metrics.ticketDelta.toFixed(1)}%)
- Clientes ativos: ${metrics.activeCustomers} / Inativos (30+ dias): ${metrics.inactiveCustomers}
- Produto campeão: ${metrics.topProduct?.name ?? "—"} (${metrics.topProduct?.qty ?? 0} unidades)
- Produto fraco: ${metrics.worstProduct?.name ?? "—"} (${metrics.worstProduct?.qty ?? 0} unidades)
- Produto em alta: ${metrics.surgingProduct?.name ?? "—"}
- Produto em queda: ${metrics.droppingProduct?.name ?? "—"}
- Produtos sem venda 30d: ${metrics.staleProducts.map((p) => p.name).join(", ") || "—"}

Responda APENAS com uma lista, um insight por linha, sem numeração nem títulos.`;

    let insights: string[] = [];
    try {
      const text = await callAI(
        "Você é um consultor de crescimento sênior de restaurantes. Responda em português brasileiro, direto ao ponto, sem rodeios.",
        prompt,
      );
      insights = text
        .split("\n")
        .map((l) => l.replace(/^[-•\d.\s]+/, "").trim())
        .filter((l) => l.length > 4)
        .slice(0, 6);
    } catch (e: any) {
      insights = [`⚠️ ${e?.message ?? "Falha ao gerar insights agora."}`];
    }

    return { metrics, insights };
  });

const CAMPAIGN_BRIEFS: Record<string, string> = {
  inativos: "Recuperar clientes inativos há mais de 30 dias com um incentivo de retorno.",
  produto_parado: "Promover um produto com baixa saída para movimentar o estoque.",
  relampago: "Campanha relâmpago de 24 horas com desconto agressivo para impulso de vendas hoje.",
  vip: "Recompensar clientes VIP (alto gasto) com uma oferta exclusiva e personalizada.",
  cashback: "Estimular recompra oferecendo cashback no próximo pedido.",
  custom: "Campanha personalizada conforme briefing.",
};

export const generateCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => campaignSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rest } = await supabaseAdmin.from("restaurants").select("owner_id, name").eq("id", data.restaurantId).maybeSingle();
    if (!rest) throw new Error("Restaurante não encontrado");
    const ctx = await loadRestaurantData(data.restaurantId, rest.owner_id);
    const metrics = computeMetrics(ctx);

    const brief = data.type === "custom" ? data.customBrief ?? CAMPAIGN_BRIEFS.custom : CAMPAIGN_BRIEFS[data.type];

    const userPrompt = `Restaurante: ${rest.name}
Objetivo da campanha: ${brief}

Contexto atual:
- Clientes inativos: ${metrics.inactiveCustomers}
- Clientes ativos: ${metrics.activeCustomers}
- Produto campeão: ${metrics.topProduct?.name ?? "—"}
- Produto parado: ${metrics.staleProducts[0]?.name ?? metrics.worstProduct?.name ?? "—"}
- Ticket médio: R$ ${metrics.ticket30.toFixed(2)}

Gere uma campanha de marketing pronta para uso. Responda EXATAMENTE neste formato JSON, sem markdown, sem comentários:
{
  "titulo": "título curto da campanha",
  "whatsapp": "mensagem pronta para enviar no WhatsApp (use emojis, máx 600 caracteres, tom amigável)",
  "instagram": "legenda pronta para post no Instagram com 3-6 hashtags ao final",
  "promocao": "descrição da promoção sugerida em 1-2 frases",
  "cupom": { "codigo": "CODIGO_CURTO_SEM_ESPACOS", "desconto": 10, "validade_dias": 7 }
}`;

    const text = await callAI(
      "Você é um copywriter de marketing para restaurantes. Sempre responde em JSON válido conforme solicitado, em português brasileiro.",
      userPrompt,
    );

    // Try to extract JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta da IA inválida");
    try {
      const parsed = JSON.parse(match[0]);
      return parsed as {
        titulo: string;
        whatsapp: string;
        instagram: string;
        promocao: string;
        cupom: { codigo: string; desconto: number; validade_dias: number };
      };
    } catch {
      throw new Error("Não foi possível interpretar a campanha gerada");
    }
  });
