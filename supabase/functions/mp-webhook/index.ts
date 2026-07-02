// Mercado Pago — Webhook receiver.
// Responsabilidades:
//   1. Aceitar POST rapidamente.
//   2. Validar assinatura (x-signature) contra MP_WEBHOOK_SECRET.
//   3. Persistir evento (idempotência por event_id).
//   4. Processar (consulta MP, atualiza order_payment / orders / financial_ledger).
//   5. Publicar log (payment_webhook_events + payment_event_queue em caso de erro).
//
// Nunca expõe tokens; usa access token do restaurante (via external_reference → order → restaurant)
// ou fallback MP_ACCESS_TOKEN.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";

type MpStatus = "approved"|"pending"|"in_process"|"rejected"|"cancelled"|"refunded"|"charged_back"|"expired";
type LocalStatus = "PENDING"|"PROCESSING"|"APPROVED"|"REJECTED"|"CANCELLED"|"EXPIRED"|"REFUNDED"|"CHARGEBACK";

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function mapStatus(s: string | null | undefined): LocalStatus {
  switch ((s ?? "").toLowerCase() as MpStatus) {
    case "approved": return "APPROVED";
    case "in_process": return "PROCESSING";
    case "pending": return "PENDING";
    case "rejected": return "REJECTED";
    case "cancelled": return "CANCELLED";
    case "expired": return "EXPIRED";
    case "refunded": return "REFUNDED";
    case "charged_back": return "CHARGEBACK";
    default: return "PENDING";
  }
}

async function verifySignature(opts: {
  secret: string | null;
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): Promise<boolean> {
  if (!opts.secret) return true; // sem secret configurado: aceita e loga
  if (!opts.xSignature || !opts.xRequestId || !opts.dataId) return false;
  const parts: Record<string,string> = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, ...r] = p.trim().split("=");
      return [k.trim(), r.join("=").trim()];
    }),
  );
  const ts = parts.ts, v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${opts.dataId};request-id:${opts.xRequestId};ts:${ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(opts.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

async function getAccessTokenForOrder(sb: SupabaseClient, restaurantId: string | null): Promise<string | null> {
  if (restaurantId) {
    const { data } = await sb
      .from("mercado_pago_accounts")
      .select("access_token, connected")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (data?.connected && data.access_token) {
      const tok = await decryptToken(data.access_token);
      if (tok) return tok;
    }
  }
  return Deno.env.get("MP_ACCESS_TOKEN") ?? null;
}

async function fetchMpPayment(token: string, paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const sb = admin();
  const rawBody = await req.text();
  const body = (() => { try { return JSON.parse(rawBody); } catch { return {}; } })();

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const eventType = String(body?.type ?? body?.topic ?? "").toLowerCase() || null;
  const action = String(body?.action ?? "").toLowerCase() || null;
  const resourceId = String(body?.data?.id ?? body?.resource ?? body?.id ?? "") || null;
  const eventId = String(body?.id ?? "") || (resourceId && action ? `${action}:${resourceId}` : null);
  const externalRef = body?.external_reference ?? body?.data?.external_reference ?? null;

  // Persistência com idempotência por (provider, event_id)
  const insertPayload = {
    provider: "mercado_pago",
    event_id: eventId,
    event_type: eventType,
    action,
    resource_id: resourceId,
    external_reference: externalRef,
    payload_json: body,
    signature: xSignature,
  };

  let eventPk: string | null = null;
  let duplicated = false;
  if (eventId) {
    const { data: existing } = await sb
      .from("payment_webhook_events")
      .select("id, processed")
      .eq("provider", "mercado_pago")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing) {
      duplicated = true;
      eventPk = existing.id;
    }
  }
  if (!eventPk) {
    const { data: inserted, error } = await sb
      .from("payment_webhook_events")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error) {
      console.error("[mp-webhook] insert failed", error);
      return json({ ok: false, error: "persist_failed" }, { status: 500 });
    }
    eventPk = inserted.id;
  }

  if (duplicated) {
    return json({ ok: true, duplicated: true });
  }

  // Validar assinatura
  const okSig = await verifySignature({
    secret: Deno.env.get("MP_WEBHOOK_SECRET") ?? null,
    xSignature,
    xRequestId,
    dataId: resourceId,
  });
  if (!okSig) {
    await sb.from("payment_webhook_events").update({
      processed: false,
      error_message: "invalid_signature",
      processing_attempts: 1,
    }).eq("id", eventPk);
    return json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const isPayment = (eventType?.includes("payment")) || (action?.startsWith("payment."));
  if (!isPayment || !resourceId) {
    await sb.from("payment_webhook_events").update({
      processed: true,
      processed_at: new Date().toISOString(),
      error_message: "ignored: not a payment event",
    }).eq("id", eventPk);
    return json({ ok: true, ignored: true });
  }

  try {
    // Localiza pedido primeiro (para pegar restaurant_id → access token)
    const { data: op } = await sb
      .from("order_payment")
      .select("order_id, orders:order_id(id, restaurant_id)")
      .eq("provider_payment_id", resourceId)
      .maybeSingle();

    let orderId: string | null = op?.order_id ?? null;
    let restaurantId: string | null = (op as any)?.orders?.restaurant_id ?? null;

    if (!orderId && externalRef) {
      const { data: opRef } = await sb
        .from("order_payment")
        .select("order_id, orders:order_id(id, restaurant_id)")
        .eq("order_id", externalRef)
        .maybeSingle();
      orderId = opRef?.order_id ?? null;
      restaurantId = (opRef as any)?.orders?.restaurant_id ?? restaurantId;
    }

    const token = await getAccessTokenForOrder(sb, restaurantId);
    if (!token) throw new Error("no_access_token");
    const mp = await fetchMpPayment(token, resourceId);
    if (!mp) throw new Error("mp_payment_not_found");

    const local = mapStatus(mp.status);
    if (!orderId) {
      // tenta external_reference vindo do MP
      const extFromMp = mp.external_reference;
      if (extFromMp) {
        const { data: opMp } = await sb
          .from("order_payment")
          .select("order_id, orders:order_id(id, restaurant_id)")
          .eq("order_id", extFromMp)
          .maybeSingle();
        orderId = opMp?.order_id ?? null;
        restaurantId = (opMp as any)?.orders?.restaurant_id ?? restaurantId;
      }
    }

    if (!orderId) {
      await sb.from("payment_webhook_events").update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: "order_not_found",
      }).eq("id", eventPk);
      return json({ ok: true, warning: "order_not_found" });
    }

    const amount = Number(mp.transaction_amount ?? 0) || 0;

    await sb.from("order_payment").update({
      status: local,
      transaction_amount: amount,
      provider_payment_id: String(mp.id),
      updated_at: new Date().toISOString(),
    }).eq("order_id", orderId);

    if (local === "APPROVED") {
      await sb.from("orders").update({ status: "novo" }).eq("id", orderId);
      await sb.from("financial_ledger").insert({
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "PAYMENT_APPROVED", amount, currency: mp.currency_id ?? "BRL",
        status: "COMPLETED", reference_type: "mp_payment", reference_id: String(mp.id),
        description: "Pagamento aprovado", metadata: { status_detail: mp.status_detail ?? null },
      });
    } else if (local === "PENDING" || local === "PROCESSING") {
      await sb.from("financial_ledger").insert({
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "PAYMENT_PENDING", amount, currency: mp.currency_id ?? "BRL",
        status: "PENDING", reference_type: "mp_payment", reference_id: String(mp.id),
        description: "Pagamento pendente",
      });
    } else if (local === "REJECTED" || local === "CANCELLED" || local === "EXPIRED") {
      await sb.from("financial_ledger").insert({
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "PAYMENT_FAILED", amount, currency: mp.currency_id ?? "BRL",
        status: "FAILED", reference_type: "mp_payment", reference_id: String(mp.id),
        description: `Pagamento ${local.toLowerCase()}`,
      });
    } else if (local === "REFUNDED") {
      await sb.from("financial_ledger").insert({
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "REFUND", amount, currency: mp.currency_id ?? "BRL",
        status: "COMPLETED", reference_type: "mp_payment", reference_id: String(mp.id),
        description: "Estorno",
      });
    } else if (local === "CHARGEBACK") {
      await sb.from("financial_ledger").insert({
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "CHARGEBACK", amount, currency: mp.currency_id ?? "BRL",
        status: "COMPLETED", reference_type: "mp_payment", reference_id: String(mp.id),
        description: "Chargeback",
      });
    }

    await sb.from("payment_webhook_events").update({
      processed: true,
      processed_at: new Date().toISOString(),
      processing_attempts: 1,
    }).eq("id", eventPk);

    return json({ ok: true, status: local, orderId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mp-webhook] processing error", msg);
    await sb.from("payment_webhook_events").update({
      processed: false,
      error_message: msg,
      processing_attempts: 1,
    }).eq("id", eventPk);
    const nextRetry = new Date(Date.now() + 60_000).toISOString();
    await sb.from("payment_event_queue").insert({
      event_id: eventPk,
      status: "pending",
      retry_count: 0,
      next_retry: nextRetry,
      last_error: msg,
    });
    return json({ ok: false, error: msg }, { status: 200 }); // 200 para MP não reenviar em loop
  }
});
