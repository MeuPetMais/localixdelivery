// Stripe — Webhook receiver (Sandbox only).
// Verifica assinatura (Stripe-Signature v1), aplica idempotência via
// payment_webhook_events (provider, event_id) e atualiza payments/orders
// para eventos de pagamento.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function verifyStripeSignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts: Record<string, string[]> = {};
  for (const seg of header.split(",")) {
    const [k, v] = seg.trim().split("=");
    if (!k || !v) continue;
    (parts[k] ||= []).push(v);
  }
  const ts = parts.t?.[0];
  const sigs = parts.v1 ?? [];
  if (!ts || sigs.length === 0) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");

  for (const expected of sigs) {
    if (hex.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff === 0) return true;
  }
  return false;
}

function mapStatus(stripeType: string, obj: any): { local: string; paid: boolean } | null {
  switch (stripeType) {
    case "checkout.session.completed":
      return { local: obj?.payment_status === "paid" ? "approved" : "pending", paid: obj?.payment_status === "paid" };
    case "payment_intent.succeeded":
      return { local: "approved", paid: true };
    case "payment_intent.processing":
      return { local: "in_process", paid: false };
    case "payment_intent.payment_failed":
      return { local: "rejected", paid: false };
    case "payment_intent.canceled":
      return { local: "cancelled", paid: false };
    case "charge.refunded":
      return { local: "refunded", paid: false };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST");
  if (!secret) return json({ error: "webhook_secret_missing" }, { status: 500 });

  const rawBody = await req.text();
  const okSig = await verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secret);
  if (!okSig) return json({ error: "invalid_signature" }, { status: 401 });

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "bad_json" }, { status: 400 }); }

  const sb = admin();
  const eventId: string | null = event?.id ?? null;
  const eventType: string = String(event?.type ?? "");
  const obj: any = event?.data?.object ?? {};
  const resourceId: string | null = obj?.id ?? null;
  const orderId: string | null = obj?.metadata?.order_id ?? null;
  const restaurantId: string | null = obj?.metadata?.restaurant_id ?? null;

  // Idempotência
  if (eventId) {
    const { data: exists } = await sb
      .from("payment_webhook_events")
      .select("id")
      .eq("provider", "stripe")
      .eq("event_id", eventId)
      .maybeSingle();
    if (exists) return json({ ok: true, duplicated: true });
  }

  const { data: inserted, error: insertErr } = await sb
    .from("payment_webhook_events")
    .insert({
      provider: "stripe",
      event_id: eventId,
      event_type: eventType,
      action: eventType,
      resource_id: resourceId,
      external_reference: orderId,
      payload_json: event,
      signature: req.headers.get("stripe-signature"),
    })
    .select("id")
    .single();
  if (insertErr) {
    // Se conflito da unique, trata como duplicado
    if (String(insertErr.message).toLowerCase().includes("duplicate")) {
      return json({ ok: true, duplicated: true });
    }
    console.error("[stripe-webhook] insert error", insertErr);
    return json({ error: "persist_failed" }, { status: 500 });
  }

  const mapped = mapStatus(eventType, obj);
  if (!mapped) {
    await sb.from("payment_webhook_events").update({
      processed: true,
      processed_at: new Date().toISOString(),
      error_message: "ignored: unsupported event type",
    }).eq("id", inserted.id);
    return json({ ok: true, ignored: true });
  }

  try {
    // Localiza payment por checkout_session (obj.id) OU payment_intent
    const candidates: string[] = [];
    if (eventType.startsWith("checkout.session")) candidates.push(String(obj.id));
    if (eventType.startsWith("payment_intent")) candidates.push(String(obj.id));
    if (obj?.payment_intent) candidates.push(String(obj.payment_intent));

    let payment: any = null;
    for (const ext of candidates) {
      const { data } = await sb.from("payments").select("*").eq("external_id", ext).maybeSingle();
      if (data) { payment = data; break; }
    }

    const paidAt = mapped.paid ? new Date().toISOString() : null;

    if (payment) {
      await sb.from("payments").update({
        status: mapped.local,
        paid_at: paidAt ?? payment.paid_at,
        raw: { ...(payment.raw ?? {}), last_event: eventType, last_event_id: eventId },
      }).eq("id", payment.id);
    }

    if (orderId && mapped.paid) {
      // Pedido pago avança para 'pago' (nunca volta para 'novo').
      // Só promove se o pedido ainda estiver aguardando pagamento — nunca rebaixa
      // um pedido já em preparo/saiu/entregue.
      await sb
        .from("orders")
        .update({ status: "pago" })
        .eq("id", orderId)
        .in("status", ["aguardando_pagamento", "aguardando_confirmacao", "novo"]);
      // ledger idempotente por reference_id
      const refId = String(obj.payment_intent ?? obj.id);
      const { data: ledgerExists } = await sb
        .from("financial_ledger")
        .select("id")
        .eq("provider", "stripe")
        .eq("reference_type", "stripe_payment")
        .eq("reference_id", refId)
        .maybeSingle();
      if (!ledgerExists) {
        await sb.from("financial_ledger").insert({
          order_id: orderId,
          restaurant_id: restaurantId,
          provider: "stripe",
          transaction_type: "PAYMENT_APPROVED",
          amount: payment ? Number(payment.amount) : (Number(obj.amount ?? obj.amount_total ?? 0) / 100),
          currency: "BRL",
          status: "COMPLETED",
          reference_type: "stripe_payment",
          reference_id: refId,
          description: "Pagamento Stripe aprovado",
          metadata: { event_type: eventType },
        });
      }
    }

    await sb.from("payment_webhook_events").update({
      processed: true,
      processed_at: new Date().toISOString(),
    }).eq("id", inserted.id);

    return json({ ok: true, status: mapped.local });
  } catch (e: any) {
    console.error("[stripe-webhook] process error", e?.message);
    await sb.from("payment_webhook_events").update({
      processed: false,
      error_message: String(e?.message ?? e),
      processing_attempts: 1,
    }).eq("id", inserted.id);
    return json({ error: "processing_failed", detail: String(e?.message ?? e) }, { status: 500 });
  }
});
