// Mercado Pago â€” Webhook receiver.
// Responsabilidades:
//   1. Aceitar POST rapidamente.
//   2. Validar assinatura (x-signature) contra MP_WEBHOOK_SECRET.
//   3. Persistir evento (idempotÃªncia por event_id).
//   4. Processar (consulta MP, atualiza order_payment / orders / financial_ledger).
//   5. Publicar log (payment_webhook_events + payment_event_queue em caso de erro).
//
// Nunca expÃµe tokens; usa access token do restaurante (via external_reference â†’ order â†’ restaurant)

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { transitionOrder } from "../_shared/order-transition.ts";
import { persistPaymentSplitByOrderOrThrow } from "../_shared/payment-split.ts";
import {
  buildMercadoPagoSplitReconciliationPlan,
  mapMercadoPagoStatus,
  type LocalStatus,
  type PricingSnapshot,
} from "../_shared/mp-reconciliation.ts";
import {
  getRequiredMpEnvironmentConfig,
  getRestaurantMpAccessToken,
  resolveMercadoPagoPaymentAccessToken,
  validateMercadoPagoAccountEnvironment,
  verifyMercadoPagoWebhookSignature,
} from "../_shared/mp-security.ts";


function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function validatePaymentAccountEnvironment(
  sb: SupabaseClient,
  restaurantId: string,
  environmentConfig: Extract<ReturnType<typeof getRequiredMpEnvironmentConfig>, { ok: true }>,
) {
  const { data, error } = await sb
    .from("mercado_pago_accounts")
    .select("mp_user_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;

  const validation = validateMercadoPagoAccountEnvironment(data, Deno.env, environmentConfig);
  if (!validation.ok) throw new Error(validation.error);
}

async function getSellerOAuthTokenForOrder(sb: SupabaseClient, restaurantId: string | null): Promise<string> {
  console.log("[mp-webhook] getSellerOAuthTokenForOrder", {
    restaurant_id: restaurantId,
  });
  const result = await getRestaurantMpAccessToken(sb as any, restaurantId, decryptToken);
  if (!result.ok) throw new Error(result.error);
  return result.token;
}

async function resolvePaymentLookupToken(sb: SupabaseClient, params: {
  restaurantId: string;
  paymentMethod: string | null;
  environmentConfig: Extract<ReturnType<typeof getRequiredMpEnvironmentConfig>, { ok: true }>;
}) {
  await validatePaymentAccountEnvironment(sb, params.restaurantId, params.environmentConfig);
  const method = String(params.paymentMethod ?? "").toLowerCase();
  const shouldUsePixSandboxTestToken =
    params.environmentConfig.runtimeEnvironment === "staging" &&
    params.environmentConfig.supabaseEnvironment === "staging" &&
    params.environmentConfig.mercadoPagoEnvironment === "sandbox" &&
    method === "pix";
  const sellerOAuthToken = shouldUsePixSandboxTestToken
    ? null
    : await getSellerOAuthTokenForOrder(sb, params.restaurantId);
  const tokenResolution = resolveMercadoPagoPaymentAccessToken({
    env: Deno.env,
    environmentConfig: params.environmentConfig,
    paymentMethod: method || "unknown",
    sellerOAuthToken,
  });
  if (!tokenResolution.ok) throw new Error(tokenResolution.error);
  return tokenResolution;
}

async function fetchMpPayment(token: string, paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

async function loadPricingSnapshot(sb: SupabaseClient, orderId: string, restaurantId: string): Promise<PricingSnapshot | null> {
  const { data, error } = await sb
    .from("order_pricing_snapshot")
    .select("platform_fee, customer_total, restaurant_net, gateway_fee, service_fee_payer, realized_platform_revenue, orders!inner(restaurant_id)")
    .eq("order_id", orderId)
    .eq("orders.restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    platform_fee: Number(data.platform_fee ?? 0),
    customer_total: Number(data.customer_total ?? 0),
    restaurant_net: Number(data.restaurant_net ?? 0),
    gateway_fee: Number(data.gateway_fee ?? 0),
    service_fee_payer: String(data.service_fee_payer ?? "customer"),
    realized_platform_revenue: Number(data.realized_platform_revenue ?? 0),
  };
}

async function insertLedgerOnce(sb: SupabaseClient, row: {
  order_id: string;
  restaurant_id: string | null;
  provider: string;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  reference_type: string;
  reference_id: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: existing } = await sb
    .from("financial_ledger")
    .select("id")
    .eq("transaction_type", row.transaction_type)
    .eq("reference_type", row.reference_type)
    .eq("reference_id", row.reference_id)
    .maybeSingle();
  if (existing) return;
  await sb.from("financial_ledger").insert(row);
}

async function reconcilePaymentSplit(sb: SupabaseClient, params: {
  orderId: string;
  restaurantId: string;
  paymentId: string;
  localStatus: LocalStatus;
  payment: Record<string, unknown>;
}) {
  const snapshot = await loadPricingSnapshot(sb, params.orderId, params.restaurantId);
  const plan = buildMercadoPagoSplitReconciliationPlan({
    ...params,
    snapshot,
  });
  await persistPaymentSplitByOrderOrThrow(sb, plan.splitRow);

  if (plan.realizedPlatformRevenueUpdate !== null) {
    const { error } = await sb
      .from("order_pricing_snapshot")
      .update({ realized_platform_revenue: plan.realizedPlatformRevenueUpdate })
      .eq("order_id", params.orderId);
    if (error) console.error("[mp-webhook] realized platform revenue update failed", { orderId: params.orderId, error: error.message });
  }

  if (plan.ledgerReversal) {
    await insertLedgerOnce(sb, {
      order_id: params.orderId,
      restaurant_id: params.restaurantId,
      provider: "mercado_pago",
      transaction_type: "PLATFORM_FEE_REVERSAL",
      amount: plan.ledgerReversal.amount,
      currency: String(params.payment.currency_id ?? "BRL"),
      status: "COMPLETED",
      reference_type: "mp_split_reversal",
      reference_id: plan.ledgerReversal.referenceId,
      description: "Reversao da receita Localix por reembolso Mercado Pago",
      metadata: plan.ledgerReversal.metadata,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const environmentConfig = getRequiredMpEnvironmentConfig(Deno.env);
  if (!environmentConfig.ok) {
    console.error("[mp-webhook] environment not configured", {
      provider: "mercado_pago",
      error: environmentConfig.error,
      reason: environmentConfig.reason,
      timestamp: new Date().toISOString(),
    });
    return json({ ok: false, error: environmentConfig.error }, { status: 500 });
  }

  const sb = admin();
  const rawBody = await req.text();
  const body = (() => { try { return JSON.parse(rawBody); } catch { return {}; } })();

  const url = new URL(req.url);
  const dataIdFromQuery = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const dataIdFromBody = String(body?.data?.id ?? body?.resource ?? body?.id ?? "") || null;

  // Validar assinatura (HMAC SHA-256, manifest oficial do Mercado Pago)
  // antes de qualquer persistencia/deduplicacao. Um evento nao assinado nunca
  // pode ocupar a chave de idempotencia de um webhook legitimo posterior.
  const sigResult = await verifyMercadoPagoWebhookSignature({
    secret: Deno.env.get("MP_WEBHOOK_SECRET") ?? null,
    xSignature,
    xRequestId,
    dataIdFromQuery,
    dataIdFromBody,
  });

  console.log("[mp-webhook] signature audit", {
    environment: environmentConfig.runtimeEnvironment,
    mp_environment: environmentConfig.mercadoPagoEnvironment,
    ok: sigResult.ok,
    reason: sigResult.reason ?? null,
    data_id: sigResult.dataId ?? null,
    data_id_source: dataIdFromQuery ? "query" : dataIdFromBody ? "body" : "none",
    ts: sigResult.ts ?? null,
    x_request_id: xRequestId,
    diverged_field: sigResult.ok ? null : sigResult.reason,
  });

  if (!sigResult.ok) {
    console.warn("[mp-webhook] signature invalid", {
      reason: sigResult.reason,
      resource_id: dataIdFromBody ?? dataIdFromQuery,
    });
    return json({ ok: false, error: "webhook_signature_invalid" }, { status: 401 });
  }

  const eventType = String(body?.type ?? body?.topic ?? "").toLowerCase() || null;
  const action = String(body?.action ?? "").toLowerCase() || null;
  const resourceId = dataIdFromBody ?? dataIdFromQuery;
  const eventId = String(body?.id ?? "") || (resourceId && action ? `${action}:${resourceId}` : null);
  const externalRef = body?.external_reference ?? body?.data?.external_reference ?? null;

  // PersistÃªncia com idempotÃªncia por (provider, event_id)
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
      eventPk = existing.id;
      duplicated = existing.processed === true;
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
    // Localiza pedido primeiro (para pegar restaurant_id â†’ access token)
    const { data: op } = await sb
      .from("order_payment")
      .select("order_id, payment_method, orders:order_id(id, restaurant_id)")
        .eq("payment_id", resourceId)
        .maybeSingle();


    let orderId: string | null = op?.order_id ?? null;
    let restaurantId: string | null = (op as any)?.orders?.restaurant_id ?? null;
    let paymentMethod: string | null = (op as any)?.payment_method ?? null;

    if (!orderId && externalRef) {
      const { data: opRef } = await sb
        .from("order_payment")
        .select("order_id, payment_method, orders:order_id(id, restaurant_id)")
        .eq("order_id", externalRef)
        .maybeSingle();
      orderId = opRef?.order_id ?? null;
      restaurantId = (opRef as any)?.orders?.restaurant_id ?? restaurantId;
      paymentMethod = (opRef as any)?.payment_method ?? paymentMethod;
    }

    if (!restaurantId) {
      await sb.from("payment_webhook_events").update({
        processed: false,
        error_message: "restaurant_not_identified",
        processing_attempts: 1,
      }).eq("id", eventPk);
      await sb.from("payment_event_queue").insert({
        event_id: eventPk,
        status: "pending",
        retry_count: 0,
        next_retry: null,
        last_error: "restaurant_not_identified",
      });
      return json({ ok: true, warning: "restaurant_not_identified" });
    }

    const tokenResolution = await resolvePaymentLookupToken(sb, {
      restaurantId,
      paymentMethod,
      environmentConfig,
    });
    const mp = await fetchMpPayment(tokenResolution.token, resourceId);
    if (!mp) throw new Error("mp_payment_not_found");

    const local = mapMercadoPagoStatus(mp.status);
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
    const ticketUrl = mp?.point_of_interaction?.transaction_data?.ticket_url
      ?? mp?.transaction_details?.external_resource_url
      ?? null;
    const qr = mp?.point_of_interaction?.transaction_data ?? {};

    // order_payment â€” upsert (garante linha mesmo se checkout nÃ£o criou)
    const { data: opUp, error: opErr } = await sb.from("order_payment").upsert({
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
    }, { onConflict: "order_id" }).select("id");
    if (opErr || !opUp || opUp.length === 0) {
      console.error("[mp-webhook] order_payment upsert failed", { orderId, error: opErr?.message, rows: opUp?.length ?? 0 });
    }

    // payments â€” mesma estrutura que Stripe (cross-gateway).
    const { error: payErr } = await sb.from("payments").upsert({
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
    }, { onConflict: "provider,external_id" });
    if (payErr) console.error("[mp-webhook] payments upsert failed", { orderId, mpId: String(mp.id), error: payErr.message });


    // RC4.2 â€” Mapeamento evento â†’ status do domÃ­nio (via endpoint interno).
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
        metadata: { mp_status: mp.status, mp_status_detail: mp.status_detail ?? null, event_id: eventId },
      });
      if (!tr.ok) {
        console.warn("[mp-webhook] order transition rejected", { orderId, correlationId, reason: tr.reason ?? tr.error });
      }
    }

    if (local === "APPROVED") {
      await insertLedgerOnce(sb, {
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "PAYMENT_APPROVED", amount, currency: mp.currency_id ?? "BRL",
        status: "COMPLETED", reference_type: "mp_payment", reference_id: String(mp.id),
        description: "Pagamento aprovado", metadata: { status_detail: mp.status_detail ?? null, correlation_id: correlationId },
      });
    } else if (local === "PENDING" || local === "PROCESSING") {
      await insertLedgerOnce(sb, {
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "PAYMENT_PENDING", amount, currency: mp.currency_id ?? "BRL",
        status: "PENDING", reference_type: "mp_payment", reference_id: String(mp.id),
        description: "Pagamento pendente", metadata: { correlation_id: correlationId },
      });
    } else if (local === "REJECTED" || local === "CANCELLED" || local === "EXPIRED") {
      await insertLedgerOnce(sb, {
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "PAYMENT_FAILED", amount, currency: mp.currency_id ?? "BRL",
        status: "FAILED", reference_type: "mp_payment", reference_id: String(mp.id),
        description: `Pagamento ${local.toLowerCase()}`, metadata: { correlation_id: correlationId },
      });
    } else if (local === "REFUNDED") {
      await insertLedgerOnce(sb, {
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "REFUND", amount, currency: mp.currency_id ?? "BRL",
        status: "COMPLETED", reference_type: "mp_payment", reference_id: String(mp.id),
        description: "Estorno", metadata: { correlation_id: correlationId },
      });
    } else if (local === "CHARGEBACK") {
      await insertLedgerOnce(sb, {
        order_id: orderId, restaurant_id: restaurantId, provider: "mercado_pago",
        transaction_type: "CHARGEBACK", amount, currency: mp.currency_id ?? "BRL",
        status: "COMPLETED", reference_type: "mp_payment", reference_id: String(mp.id),
        description: "Chargeback", metadata: { correlation_id: correlationId },
      });
    }

    await reconcilePaymentSplit(sb, {
      orderId,
      restaurantId: restaurantId!,
      paymentId: String(mp.id),
      localStatus: local,
      payment: mp,
    });

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
    return json({ ok: false, error: msg }, { status: 200 }); // 200 para MP nÃ£o reenviar em loop
  }
});
