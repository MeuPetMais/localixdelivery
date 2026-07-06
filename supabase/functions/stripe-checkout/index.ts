// Stripe — Checkout Session creator (Sandbox only).
// Cria uma Checkout Session hospedada da Stripe para um pedido existente,
// persiste um registro em `payments` (PENDING) e retorna a URL para redirect.
//
// SANDBOX-ONLY neste milestone: exige STRIPE_SECRET_KEY_TEST (`sk_test_`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function toCents(v: number): number {
  return Math.round(Number(v) * 100);
}

async function stripe(path: string, secret: string, body?: Record<string, string>) {
  const init: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) init.body = new URLSearchParams(body).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? "stripe_error";
    throw new Error(`Stripe: ${msg}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const secret = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  if (!secret || !secret.startsWith("sk_test_")) {
    return json({ error: "stripe_sandbox_key_missing" }, { status: 500 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* noop */ }

  const orderId: string | null = body?.orderId ?? null;
  const successUrl: string = body?.successUrl ?? "";
  const cancelUrl: string = body?.cancelUrl ?? "";
  const customerEmail: string | null = body?.customerEmail ?? null;

  if (!orderId || !successUrl || !cancelUrl) {
    return json({ error: "missing_params", need: ["orderId","successUrl","cancelUrl"] }, { status: 400 });
  }

  const sb = admin();

  const { data: order, error: orderErr } = await sb
    .from("orders")
    .select("id, restaurant_id, total, order_number, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) return json({ error: "db_error", detail: orderErr.message }, { status: 500 });
  if (!order) return json({ error: "order_not_found" }, { status: 404 });
  if (!order.total || Number(order.total) <= 0) return json({ error: "invalid_amount" }, { status: 400 });

  const amount = toCents(Number(order.total));

  // Cria a Checkout Session (Stripe hospedado)
  const params: Record<string, string> = {
    mode: "payment",
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": `Pedido #${order.order_number ?? order.id.slice(0, 8)}`,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[order_id]": order.id,
    "metadata[restaurant_id]": order.restaurant_id,
    "payment_intent_data[metadata][order_id]": order.id,
    "payment_intent_data[metadata][restaurant_id]": order.restaurant_id,
  };
  if (customerEmail) params.customer_email = customerEmail;

  let session;
  try {
    session = await stripe("/checkout/sessions", secret, params);
  } catch (e: any) {
    console.error("[stripe-checkout] create session failed", e?.message);
    return json({ error: "stripe_failed", detail: String(e?.message ?? e) }, { status: 502 });
  }

  // Registra payment PENDING (idempotente via external_id)
  const externalId = String(session.id);
  const existing = await sb.from("payments").select("id").eq("external_id", externalId).maybeSingle();
  if (!existing.data) {
    await sb.from("payments").insert({
      order_id: order.id,
      restaurant_id: order.restaurant_id,
      provider: "stripe",
      external_id: externalId,
      method: "credit_card",
      status: "pending",
      amount: Number(order.total),
      platform_fee: 0,
      net_amount: Number(order.total),
      currency: "BRL",
      raw: { checkout_session_id: session.id, payment_intent: session.payment_intent ?? null },
    });
  }

  return json({
    ok: true,
    sessionId: session.id,
    url: session.url,
    paymentIntentId: session.payment_intent ?? null,
  });
});
