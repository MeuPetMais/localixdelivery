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
import { transitionOrder } from "../_shared/order-transition.ts";
import { recordChargebackLedger } from "./chargeback-ledger.ts";
import { recordMercadoPagoLedger } from "./ledger-idempotency.ts";
import { recordPaymentRefunds } from "./refund-ledger.ts";
import { normalizeMpUserId, resolveMercadoPagoWebhookToken } from "./token-resolution.ts";
import { validateTrustedMpPaymentContext } from "./trust-boundary.ts";

type MpStatus =
  | "approved"
  | "pending"
  | "in_process"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"
  | "expired";
type LocalStatus =
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "CHARGEBACK";

function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapStatus(s: string | null | undefined): LocalStatus {
  switch ((s ?? "").toLowerCase() as MpStatus) {
    case "approved":
      return "APPROVED";
    case "in_process":
      return "PROCESSING";
    case "pending":
      return "PENDING";
    case "rejected":
      return "REJECTED";
    case "cancelled":
      return "CANCELLED";
    case "expired":
      return "EXPIRED";
    case "refunded":
      return "REFUNDED";
    case "charged_back":
      return "CHARGEBACK";
    default:
      return "PENDING";
  }
}

/**
 * Validação HMAC oficial do webhook do Mercado Pago.
 *
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *   - `data.id`: preferir o valor vindo da query string (`?data.id=...`),
 *     normalizado em lowercase. Fallback: `data.id` do body.
 *   - `x-request-id`: header `x-request-id`.
 *   - `ts` e `v1`: extraídos do header `x-signature` (`ts=...,v1=...`).
 * Algoritmo: HMAC-SHA256; saída em hex lowercase; comparação constant-time.
 */
async function verifySignature(opts: {
  secret: string | null;
  xSignature: string | null;
  xRequestId: string | null;
  dataIdFromQuery: string | null;
  dataIdFromBody: string | null;
}): Promise<{
  ok: boolean;
  reason?: string;
  manifest?: string;
  dataId?: string;
  ts?: string;
  calculated?: string;
  received?: string;
}> {
  if (!opts.secret) return { ok: false, reason: "missing_secret" };
  if (!opts.xSignature) return { ok: false, reason: "missing_x_signature_header" };

  const parts: Record<string, string> = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, ...r] = p.trim().split("=");
      return [k.trim(), r.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = (parts.v1 ?? "").toLowerCase();
  if (!ts) return { ok: false, reason: "missing_ts_in_x_signature" };
  if (!v1) return { ok: false, reason: "missing_v1_in_x_signature" };

  const rawDataId = opts.dataIdFromQuery ?? opts.dataIdFromBody ?? "";
  if (!rawDataId) return { ok: false, reason: "missing_data_id" };
  const dataId = rawDataId.toLowerCase();

  const requestId = opts.xRequestId ?? "";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(opts.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (hex.length !== v1.length) {
    return {
      ok: false,
      reason: "length_mismatch",
      manifest,
      dataId,
      ts,
      calculated: hex,
      received: v1,
    };
  }
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  if (diff !== 0) {
    return {
      ok: false,
      reason: "hmac_mismatch",
      manifest,
      dataId,
      ts,
      calculated: hex,
      received: v1,
    };
  }
  return { ok: true, manifest, dataId, ts, calculated: hex, received: v1 };
}

async function fetchMpPayment(token: string, paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

async function fetchMpChargeback(token: string, sellerId: string, chargebackId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/chargebacks/${chargebackId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Caller-Id": sellerId,
    },
  });
  if (!res.ok) return null;
  return await res.json();
}

function isUuid(value: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? ""),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const sb = admin();
  const rawBody = await req.text();
  const body = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  })();

  const url = new URL(req.url);
  const dataIdFromQuery = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const eventType = String(body?.type ?? body?.topic ?? "").toLowerCase() || null;
  const action = String(body?.action ?? "").toLowerCase() || null;
  const dataIdFromBody = String(body?.data?.id ?? body?.resource ?? body?.id ?? "") || null;
  const resourceId = dataIdFromBody ?? dataIdFromQuery;
  const eventId =
    String(body?.id ?? "") || (resourceId && action ? `${action}:${resourceId}` : null);
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

  // Validar assinatura (HMAC SHA-256, manifest oficial do Mercado Pago)
  const sigResult = await verifySignature({
    secret: Deno.env.get("MP_WEBHOOK_SECRET") ?? null,
    xSignature,
    xRequestId,
    dataIdFromQuery,
    dataIdFromBody,
  });

  console.log("[mp-webhook] signature audit", {
    ok: sigResult.ok,
    reason: sigResult.reason ?? null,
    manifest: sigResult.manifest ?? null,
    data_id: sigResult.dataId ?? null,
    data_id_source: dataIdFromQuery ? "query" : dataIdFromBody ? "body" : "none",
    ts: sigResult.ts ?? null,
    x_request_id: xRequestId,
    calculated_hmac: sigResult.calculated ?? null,
    received_hmac: sigResult.received ?? null,
    diverged_field: sigResult.ok
      ? null
      : sigResult.reason === "hmac_mismatch" || sigResult.reason === "length_mismatch"
        ? "v1"
        : sigResult.reason,
  });

  // Assinatura inválida NÃO bloqueia o processamento:
  // o MP emite webhooks assinados com o segredo da conta collector (não do App OAuth),
  // então HMAC vs MP_WEBHOOK_SECRET diverge estruturalmente em fluxos multi-conta.
  // Em vez de rejeitar, autenticamos o evento consultando o pagamento na API do MP
  // com o access token OAuth do próprio restaurante — se o MP confirmar o payment_id,
  // é prova criptográfica de que o evento é legítimo. Registramos o incidente para
  // auditoria, mas seguimos o fluxo para não travar o pedido em aguardando_pagamento.
  if (!sigResult.ok) {
    console.warn("[mp-webhook] signature invalid — falling back to MP API verification", {
      reason: sigResult.reason,
      resource_id: resourceId,
    });
    await sb
      .from("payment_webhook_events")
      .update({
        error_message: `signature_bypass:${sigResult.reason ?? "unknown"}`,
      })
      .eq("id", eventPk);
  }

  const isPayment = eventType?.includes("payment") || action?.startsWith("payment.");
  const isChargebackCase = eventType === "topic_chargebacks_wh";
  if ((!isPayment && !isChargebackCase) || !resourceId) {
    await sb
      .from("payment_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: "ignored: not a payment event",
      })
      .eq("id", eventPk);
    return json({ ok: true, ignored: true });
  }

  try {
    const failClosed = async (reason: string) => {
      await sb
        .from("payment_webhook_events")
        .update({
          processed: false,
          processed_at: null,
          error_message: `trust_boundary:${reason}`,
          processing_attempts: 1,
        })
        .eq("id", eventPk);
      return json({ ok: false, error: reason }, { status: 200 });
    };

    const webhookUserId = normalizeMpUserId(body?.user_id ?? body?.data?.user_id);
    const tokenResolution = await resolveMercadoPagoWebhookToken(sb, {
      restaurantId: null,
      webhookUserId,
      decryptToken,
      fallbackAccessToken: null,
    });
    console.log("[mp-webhook] token resolution", {
      ok: tokenResolution.ok,
      source: tokenResolution.ok ? tokenResolution.source : null,
      reason: tokenResolution.ok ? null : tokenResolution.reason,
      restaurant_id: tokenResolution.restaurantId,
      webhook_user_id: webhookUserId,
    });
    if (!tokenResolution.ok) return await failClosed(tokenResolution.reason);
    const token = tokenResolution.token;

    let paymentResourceId = resourceId;
    let chargeback: Record<string, unknown> | null = null;
    let chargebackAmount: number | null = null;

    if (isChargebackCase) {
      if (!webhookUserId) return await failClosed("missing_mp_user_id");
      const bodyPaymentId = String(body?.data?.payment_id ?? "").trim();
      if (!bodyPaymentId) return await failClosed("missing_chargeback_payment_id");

      chargeback = await fetchMpChargeback(token, webhookUserId, resourceId);
      if (!chargeback) return await failClosed("mp_chargeback_not_found");
      if (String(chargeback?.id ?? "") !== String(resourceId)) {
        return await failClosed("mp_chargeback_id_mismatch");
      }

      const casePayments = Array.isArray(chargeback?.payments)
        ? chargeback.payments.map((value: unknown) => String(value))
        : [];
      if (!casePayments.includes(bodyPaymentId)) {
        return await failClosed("mp_chargeback_payment_mismatch");
      }

      const parsedChargebackAmount = Number(chargeback?.amount);
      if (!Number.isFinite(parsedChargebackAmount) || parsedChargebackAmount <= 0) {
        return await failClosed("invalid_chargeback_amount");
      }
      if (String(chargeback?.currency ?? "") !== "BRL") {
        return await failClosed("chargeback_currency_mismatch");
      }

      chargebackAmount = parsedChargebackAmount;
      paymentResourceId = bodyPaymentId;
    }

    const mp = await fetchMpPayment(token, paymentResourceId);
    if (!mp) return await failClosed("mp_payment_not_found");

    if (String(mp?.id ?? "") !== String(paymentResourceId)) return await failClosed("mp_id_mismatch");
    const mpExternalReference = String(mp?.external_reference ?? "").trim();
    if (!isUuid(mpExternalReference)) return await failClosed("missing_mp_external_reference");

    const [
      { data: order, error: orderErr },
      { data: op, error: opLookupErr },
      { data: snapshot, error: snapshotErr },
    ] = await Promise.all([
      sb
        .from("orders")
        .select("id, restaurant_id, status")
        .eq("id", mpExternalReference)
        .maybeSingle(),
      sb
        .from("order_payment")
        .select("order_id, restaurant_id, payment_id, transaction_amount")
        .eq("order_id", mpExternalReference)
        .eq("provider", "mercado_pago")
        .maybeSingle(),
      sb
        .from("order_pricing_snapshot")
        .select("order_id, customer_total, currency")
        .eq("order_id", mpExternalReference)
        .maybeSingle(),
    ]);
    if (orderErr) throw new Error(`order_lookup:${orderErr.message}`);
    if (opLookupErr) throw new Error(`order_payment_lookup:${opLookupErr.message}`);
    if (snapshotErr) throw new Error(`snapshot_lookup:${snapshotErr.message}`);

    const restaurantId = order?.restaurant_id ?? null;
    if (!restaurantId) return await failClosed("order_not_found");
    const [{ data: restaurant, error: restaurantErr }, { data: account, error: accountErr }] =
      await Promise.all([
        sb.from("restaurants").select("id").eq("id", restaurantId).maybeSingle(),
        sb
          .from("mercado_pago_accounts")
          .select("restaurant_id, mp_user_id, connected")
          .eq("restaurant_id", restaurantId)
          .maybeSingle(),
      ]);
    if (restaurantErr) throw new Error(`restaurant_lookup:${restaurantErr.message}`);
    if (accountErr) throw new Error(`mp_account_lookup:${accountErr.message}`);

    const trust = validateTrustedMpPaymentContext({
      resourceId: paymentResourceId,
      mp,
      order,
      orderPayment: op,
      snapshot,
      restaurant,
      account,
    });
    if (!trust.ok) return await failClosed(trust.reason);

    const orderId = trust.orderId;
    const local: LocalStatus = isChargebackCase ? "CHARGEBACK" : mapStatus(mp.status);
    const amount = trust.amount;

    if (isChargebackCase && chargebackAmount != null && chargebackAmount > amount) {
      return await failClosed("chargeback_amount_exceeds_payment");
    }
    const ticketUrl =
      mp?.point_of_interaction?.transaction_data?.ticket_url ??
      mp?.transaction_details?.external_resource_url ??
      null;
    const qr = mp?.point_of_interaction?.transaction_data ?? {};

    // order_payment — upsert (garante linha mesmo se checkout não criou)
    const { data: opUp, error: opErr } = await sb
      .from("order_payment")
      .upsert(
        {
          order_id: orderId,
          restaurant_id: restaurantId!,
          provider: "mercado_pago",
          payment_method: mp?.payment_type_id === "credit_card" ? "credit_card" : "pix",
          status: local,
          transaction_amount: amount,
          payment_id: String(mp.id),
          payment_intent: String(mp.id),
          external_reference: mp?.external_reference ?? orderId,
          payment_url: ticketUrl,
          qr_code: qr.qr_code ?? null,
          qr_code_base64: qr.qr_code_base64 ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id" },
      )
      .select("id");
    if (opErr || !opUp || opUp.length === 0) {
      console.error("[mp-webhook] order_payment upsert failed", {
        orderId,
        error: opErr?.message,
        rows: opUp?.length ?? 0,
      });
    }

    // payments — mesma estrutura que Stripe (cross-gateway).
    const { error: payErr } = await sb.from("payments").upsert(
      {
        order_id: orderId,
        restaurant_id: restaurantId!,
        provider: "mercado_pago",
        external_id: String(mp.id),
        method: mp?.payment_type_id === "credit_card" ? "card" : "pix",
        status: local.toLowerCase(),
        amount,
        currency: mp?.currency_id ?? "BRL",
        qr_code: qr.qr_code ?? null,
        qr_code_base64: qr.qr_code_base64 ?? null,
        ticket_url: ticketUrl,
        payer_email: mp?.payer?.email ?? null,
        paid_at: local === "APPROVED" ? (mp?.date_approved ?? new Date().toISOString()) : null,
        raw: mp,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,external_id" },
    );
    if (payErr)
      console.error("[mp-webhook] payments upsert failed", {
        orderId,
        mpId: String(mp.id),
        error: payErr.message,
      });

    // RC4.2 — Mapeamento evento → status do domínio (via endpoint interno).
    const correlationId = `mp:${eventId ?? resourceId ?? crypto.randomUUID()}`;
    const domainTarget: Record<string, string | null> = {
      APPROVED: "pago",
      REJECTED: "falha_pagamento",
      CANCELLED: "falha_pagamento",
      EXPIRED: "falha_pagamento",
      REFUNDED: "reembolsado",
      CHARGEBACK: "chargeback",
      PENDING: null,
      PROCESSING: null,
    };
    const targetStatus = domainTarget[local];
    if (targetStatus) {
      const tr = await transitionOrder({
        orderId,
        to: targetStatus,
        reason: `mp:${local.toLowerCase()}`,
        actorType: "webhook",
        service: "mp-webhook",
        correlationId,
        metadata: {
          mp_status: mp.status,
          mp_status_detail: mp.status_detail ?? null,
          event_id: eventId,
        },
      });
      if (!tr.ok) {
        console.warn("[mp-webhook] order transition rejected", {
          orderId,
          correlationId,
          reason: tr.reason ?? tr.error,
        });
      }
    }

    if (local === "APPROVED") {
      await recordMercadoPagoLedger(sb, {
        order_id: orderId,
        restaurant_id: restaurantId,
        provider: "mercado_pago",
        transaction_type: "PAYMENT_APPROVED",
        amount,
        currency: mp.currency_id ?? "BRL",
        status: "COMPLETED",
        reference_type: "mp_payment",
        reference_id: String(mp.id),
        description: "Pagamento aprovado",
        metadata: { status_detail: mp.status_detail ?? null, correlation_id: correlationId },
      });
    } else if (local === "PENDING" || local === "PROCESSING") {
      await recordMercadoPagoLedger(sb, {
        order_id: orderId,
        restaurant_id: restaurantId,
        provider: "mercado_pago",
        transaction_type: "PAYMENT_PENDING",
        amount,
        currency: mp.currency_id ?? "BRL",
        status: "PENDING",
        reference_type: "mp_payment",
        reference_id: String(mp.id),
        description: "Pagamento pendente",
        metadata: { correlation_id: correlationId },
      });
    } else if (local === "REJECTED" || local === "CANCELLED" || local === "EXPIRED") {
      await sb.from("financial_ledger").insert({
        order_id: orderId,
        restaurant_id: restaurantId,
        provider: "mercado_pago",
        transaction_type: "PAYMENT_FAILED",
        amount,
        currency: mp.currency_id ?? "BRL",
        status: "FAILED",
        reference_type: "mp_payment",
        reference_id: String(mp.id),
        description: `Pagamento ${local.toLowerCase()}`,
        metadata: { correlation_id: correlationId },
      });
    } else if (local === "CHARGEBACK" && isChargebackCase) {
      await recordChargebackLedger(sb, {
        orderId,
        restaurantId,
        chargebackId: resourceId,
        paymentId: String(mp.id),
        amount: chargebackAmount!,
        currency: "BRL",
        correlationId,
      });
    } else if (local === "CHARGEBACK") {
      console.warn("[mp-webhook] chargeback ledger deferred to chargeback case notification", {
        payment_id: String(mp.id),
        event_id: eventId,
      });
    }

    if (local === "REFUNDED") {
      const result = await recordPaymentRefunds(sb, mp, {
        orderId,
        restaurantId,
        currency: mp.currency_id ?? "BRL",
        correlationId,
      });
      if (result.incomplete > 0 || (local === "REFUNDED" && result.recorded === 0)) {
        const reason = `refund_identity_or_amount_missing:payment_id=${String(mp.id)};incomplete=${result.incomplete}`;
        console.error("[mp-webhook] incomplete refunds", reason);
        await sb
          .from("payment_webhook_events")
          .update({
            processed: false,
            processed_at: null,
            error_message: reason,
            processing_attempts: 1,
          })
          .eq("id", eventPk);
        return json({ ok: false, error: "refund_incomplete" }, { status: 200 });
      }
    }

    await sb
      .from("payment_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_attempts: 1,
      })
      .eq("id", eventPk);

    return json({ ok: true, status: local, orderId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mp-webhook] processing error", msg);
    await sb
      .from("payment_webhook_events")
      .update({
        processed: false,
        error_message: msg,
        processing_attempts: 1,
      })
      .eq("id", eventPk);
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
