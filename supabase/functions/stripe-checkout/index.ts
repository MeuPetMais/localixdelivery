// Stripe — Checkout Session creator (Sandbox).
// Cria Checkout Session hospedada + PaymentIntent com SPLIT AUTOMÁTICO
// via Stripe Connect Express quando o restaurante possui conta ativa.
//
// Regras:
//  - Taxa da plataforma vem de `platform_settings` (mesma tabela usada
//    pelo PlatformRevenue Domain). Nenhum valor hardcoded.
//  - Se restaurante não possui conta Stripe ativa → sem split (fluxo antigo).

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
  if (!res.ok) throw new Error(`Stripe: ${data?.error?.message ?? "stripe_error"}`);
  return data;
}

// Espelha RevenueSettingsService (mesma tabela). Único ponto no edge.
async function computePlatformFee(sb: ReturnType<typeof admin>, subtotal: number): Promise<number> {
  const { data } = await sb
    .from("platform_settings")
    .select(
      "platform_fee_until_30, platform_fee_above_30, service_fee_enabled, service_fee_type, service_fee_value",
    )
    .eq("id", true)
    .maybeSingle();
  if (data?.service_fee_enabled === false) return 0;
  const untilFee = Number(data?.platform_fee_until_30 ?? 0.99);
  const aboveFee = Number(data?.platform_fee_above_30 ?? 1.49);
  const type = String(data?.service_fee_type ?? "TIERED");
  if (type === "FIXED") return Number(data?.service_fee_value ?? untilFee);
  if (type === "PERCENTAGE") return +(subtotal * Number(data?.service_fee_value ?? 0)).toFixed(2);
  // TIERED (default)
  return subtotal <= 30 ? untilFee : aboveFee;
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
  const rawMethod: string = String(body?.method ?? "card").toLowerCase();
  const method: "card" | "pix" = rawMethod === "pix" ? "pix" : "card";

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

  const amountBRL = Number(order.total);
  const amount = toCents(amountBRL);

  // Detecta conta Stripe Connect Express ativa do restaurante → habilita split.
  const { data: rest } = await sb
    .from("restaurants")
    .select("stripe_account_id, stripe_account_status, stripe_charges_enabled")
    .eq("id", order.restaurant_id)
    .maybeSingle();

  const splitEligible = !!(
    rest?.stripe_account_id &&
    rest?.stripe_account_status === "active" &&
    rest?.stripe_charges_enabled
  );

  let platformFeeBRL = 0;
  let restaurantAmountBRL = amountBRL;
  if (splitEligible) {
    platformFeeBRL = await computePlatformFee(sb, amountBRL);
    if (platformFeeBRL < 0 || platformFeeBRL > amountBRL) {
      return json({ error: "invalid_platform_fee", value: platformFeeBRL }, { status: 500 });
    }
    restaurantAmountBRL = +(amountBRL - platformFeeBRL).toFixed(2);
  }

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

  if (splitEligible) {
    params["payment_intent_data[application_fee_amount]"] = String(toCents(platformFeeBRL));
    params["payment_intent_data[transfer_data][destination]"] = rest!.stripe_account_id as string;
    params["payment_intent_data[metadata][split]"] = "true";
    params["payment_intent_data[metadata][platform_fee_brl]"] = platformFeeBRL.toFixed(2);
    params["payment_intent_data[metadata][restaurant_amount_brl]"] = restaurantAmountBRL.toFixed(2);
    params["payment_intent_data[metadata][destination_account]"] = rest!.stripe_account_id as string;
  }
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
      amount: amountBRL,
      platform_fee: platformFeeBRL,
      net_amount: restaurantAmountBRL,
      currency: "BRL",
      raw: {
        checkout_session_id: session.id,
        payment_intent: session.payment_intent ?? null,
        split: splitEligible
          ? {
              destination: rest!.stripe_account_id,
              platform_fee_brl: platformFeeBRL,
              restaurant_amount_brl: restaurantAmountBRL,
            }
          : null,
      },
    });
  }

  return json({
    ok: true,
    sessionId: session.id,
    url: session.url,
    paymentIntentId: session.payment_intent ?? null,
    split: splitEligible
      ? { platformFeeBRL, restaurantAmountBRL, destination: rest!.stripe_account_id }
      : null,
  });
});
