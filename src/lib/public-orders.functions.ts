import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const ORDER_FIELDS =
  "id, order_number, status, total, discount, items, customer_name, customer_phone, address, payment_method, created_at, updated_at, estimated_delivery_time, restaurant_id";

export const getPublicOrderById = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(ORDER_FIELDS)
      .eq("id", data.id)
      .maybeSingle();
    return { order };
  });

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: orders } = await context.supabase
      .from("orders")
      .select("id, order_number, status, total, items, created_at, restaurant_id, estimated_delivery_time")
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const list = orders ?? [];
    const restaurantIds = Array.from(new Set(list.map((o) => o.restaurant_id)));
    let restaurants: Array<{ id: string; name: string; slug: string; logo_url: string | null }> = [];
    if (restaurantIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rs } = await supabaseAdmin
        .from("restaurants")
        .select("id, name, slug, logo_url")
        .in("id", restaurantIds);
      restaurants = rs ?? [];
    }

    return { orders: list, restaurants };
  });

// Cancelamento pelo cliente enquanto o pedido está aguardando pagamento.
// - Só permite quando status = 'aguardando_pagamento'.
// - Cancela o payment intent no provider (MP) e transiciona a ordem para 'cancelado'.
export const cancelOrderByCustomer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, restaurant_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (ordErr) throw new Error(ordErr.message);
    if (!order) throw new Error("Pedido não encontrado");
    if (order.status !== "aguardando_pagamento") {
      throw new Error(
        order.status === "cancelado"
          ? "Pedido já foi cancelado"
          : "Este pedido não pode mais ser cancelado",
      );
    }

    // 1) Cancela o payment intent no provider (idempotente — ignora erros do provider).
    try {
      await supabaseAdmin.functions.invoke("mp-payment-intent", {
        body: { action: "cancel", order_id: data.orderId },
      });
    } catch (e) {
      console.warn("[cancelOrderByCustomer] provider cancel failed", e);
    }

    // 2) Transiciona a ordem de forma atômica (CAS).
    const { data: tr, error: trErr } = await supabaseAdmin.rpc("order_apply_transition", {
      _order_id: data.orderId,
      _expected_from: "aguardando_pagamento",
      _next_status: "cancelado",
      _reason: "customer_cancelled_before_payment",
      _actor_type: "customer",
      _actor_id: null as unknown as string,
      _metadata: { source: "customer_ui" },
    } as never);
    if (trErr) throw new Error(trErr.message);
    const result = tr as unknown as { ok: boolean; reason?: string; current?: string };
    if (!result?.ok) {
      // Estado mudou entre a leitura e a transição (ex.: webhook aprovou).
      throw new Error(
        result?.reason === "STATE_MISMATCH"
          ? "Este pedido não pode mais ser cancelado (status alterado)"
          : (result?.reason ?? "Falha ao cancelar o pedido"),
      );
    }

    // 3) Garante order_payment.CANCELLED (a Edge já faz, mas reforçamos para
    //    o caso raro em que o provider não retornou 200).
    await supabaseAdmin
      .from("order_payment")
      .update({ status: "CANCELLED", last_error: "Cancelled by customer before payment" })
      .eq("order_id", data.orderId)
      .neq("status", "APPROVED");
    await supabaseAdmin
      .from("payments")
      .update({ status: "cancelled" })
      .eq("order_id", data.orderId)
      .neq("status", "approved");

    return { ok: true as const, restaurant_id: order.restaurant_id };
  });



