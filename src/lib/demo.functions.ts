import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_SLUG = "demo";

const FIRST_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Pedro", "Renata", "Rafael", "Sofia", "Thiago"];
const LAST_NAMES = ["Silva", "Souza", "Oliveira", "Costa", "Ferreira", "Almeida", "Pereira", "Lima", "Carvalho", "Ribeiro", "Gomes", "Martins"];
const STREETS = ["Rua das Flores", "Av. Brasil", "Rua das Acácias", "Av. Paulista", "Rua Augusta", "Rua dos Pinheiros", "Av. Atlântica", "Rua do Comércio"];
const PAYMENTS = ["Pix", "Dinheiro", "Cartão de Crédito (na entrega)", "Cartão de Débito (na entrega)"];
const NOTES = ["Sem cebola, por favor", "Capricha no molho!", "Tocar interfone duas vezes", "Entregar na portaria", "Ponto da carne ao ponto", "", "", ""];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export const createDemoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: restaurant, error: rErr } = await context.supabase
      .from("restaurants")
      .select("id, slug")
      .eq("owner_id", context.userId)
      .eq("slug", DEMO_SLUG)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!restaurant) throw new Error("Esta ação está disponível apenas na conta demo.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: products } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .limit(20);

    const pool = (products ?? []).filter((p) => Number(p.price) > 0);
    const count = Math.min(pool.length, randInt(1, 3));
    const chosen: typeof pool = [];
    while (chosen.length < count && pool.length) {
      const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      chosen.push(p);
    }
    const items = chosen.map((p) => ({
      id: p.id,
      name: p.name,
      qty: randInt(1, 2),
      price: Number(p.price),
    }));
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const customerName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const phone = `(11) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`;
    const address = `${pick(STREETS)}, ${randInt(10, 1500)} — Apto ${randInt(1, 300)}`;
    const payment = pick(PAYMENTS);
    const note = pick(NOTES);

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: phone,
        address,
        payment_method: payment,
        items: note ? [...items, { note }] : items,
        total,
        status: "novo",
        estimated_delivery_time: randInt(25, 45),
      })
      .select("id, order_number, total, customer_name")
      .single();

    if (iErr) throw new Error(iErr.message);
    return inserted;
  });

export const resetDemoEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: r, error: rErr } = await context.supabase
      .from("restaurants")
      .select("id, slug")
      .eq("owner_id", context.userId)
      .eq("slug", DEMO_SLUG)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!r) throw new Error("Apenas a conta demo pode restaurar o ambiente.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("reset_demo_environment");
    if (error) throw new Error(error.message);
    return data;
  });

