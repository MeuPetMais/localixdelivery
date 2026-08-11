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
import {
  getRequiredMpEnvironmentConfig,
  getRestaurantMpAccessToken,
  verifyMercadoPagoWebhookSignature,
} from "../_shared/mp-security.ts";


type MpStatus = "approved"|"pending"|"in_process"|"rejected"|"cancelled"|"refunded"|"charged_back"|"expired";
type LocalStatus = "PENDING"|"PROCESSING"|"APPROVED"|"REJECTED"|"CANCELLED"|"EXPIRED"|"REFUNDED"|"CHARGEBACK";
type PricingSnapshot = {
  platform_fee: number;
  customer_total: number;
  restaurant_net: number;
  gateway_fee: number;
  service_fee_payer: string;
  realized_platform_revenue: number;
};

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

async function getAccessTokenForOrder(sb: SupabaseClient, restaurantId: string | null): Promise<string> {
  console.log("[mp-webhook] getAccessTokenForOrder", {
    restaurant_id: restaurantId,
  });
  const result = await getRestaurantMpAccessToken(sb as any, restaurantId, decryptToken);
  if (!result.ok) throw new Error(result.error);
  return result.token;
}

async function fetchMpPayment(token: string, paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function extractMarketplaceFee(payment: Record<string, unknown>) {
  const direct = payment.marketplace_fee ?? payment.application_fee;
  if (direct !== undefined && direct !== null) {
    const amount = roundMoney(Number(direct));
    return Number.isFinite(amount)
      ? { ok: true as const, amount, source: direct === payment.marketplace_fee ? "marketplace_fee" : "application_fee" }
      : { ok: false as const, reason: "invalid" };
  }

  const feeDetails = Array.isArray(payment.fee_details) ? payment.fee_details : [];
  const detail = feeDetails.find((entry) => {
    const type = String((entry as { type?: unknown }).type ?? "").toLowerCase();
    const name = String((entry as { name?: unknown }).name ?? "").toLowerCase();
    return type.includes("marketplace") || type.includes("application") || name.includes("marketplace") || name.includes("application");
  }) as { amount?: unknown; type?: unknown; name?: unknown } | undefined;
  if (!detail) return { ok: false as const, reason: "missing" };
  const amount = roundMoney(Number(detail.amount));
  if (!Number.isFinite(amount)) return { ok: false as const, reason: "invalid" };
  return { ok: true as const, amount, source: String(detail.type ?? detail.name ?? "fee_details") };
}

function sumRefundedAmount(payment: Record<string, unknown>): number | null {
  const refunds = Array.isArray(payment.refunds) ? payment.refunds : null;
  if (refunds) {
    const total = refunds.reduce((sum, refund) => {
      const amount = Number((refund as { amount?: unknown }).amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    return roundMoney(total);
  }
  const transactionDetailsRefunded = (payment.transaction_details as { refunded_amount?: unknown } | undefined)?.refunded_amount;
  const direct = Number(payment.refunded_amount ?? transactionDetailsRefunded);
  return Number.isFinite(direct) && direct > 0 ? roundMoney(direct) : null;
}

function calculateRefundReversal(params: {
  localStatus: LocalStatus;
  paymentStatusDetail?: string | null;
  transactionAmount: number;
  expectedPlatformFee: number;
  payment: Record<string, unknown>;
}) {
  const statusDetail = String(params.paymentStatusDetail ?? "").toLowerCase();
  const isFullRefund = params.localStatus === "REFUNDED";
  const isPartialRefund = statusDetail === "partially_refunded";
  if (!isFullRefund && !isPartialRefund) return null;

  const transactionAmount = roundMoney(params.transactionAmount);
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    return { ok: false as const, reason: "invalid_transaction_amount" };
  }
  const refundedAmount = isFullRefund ? transactionAmount : sumRefundedAmount(params.payment);
  if (refundedAmount === null) return { ok: false as const, reason: "refund_amount_missing" };
  if (!Number.isFinite(refundedAmount) || refundedAmount < 0 || refundedAmount > transactionAmount) {
    return { ok: false as const, reason: "invalid_refund_amount" };
  }

  const ratio = Math.min(1, refundedAmount / transactionAmount);
  const reversedPlatformFee = roundMoney(params.expectedPlatformFee * ratio);
  return {
    ok: true as const,
    reversalStatus: refundedAmount >= transactionAmount ? "FULL" : "PARTIAL",
    refundedAmount,
    reversedPlatformFee,
    realizedPlatformRevenue: Math.max(0, roundMoney(params.expectedPlatformFee - reversedPlatformFee)),
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
  if (!snapshot) {
    await sb.from("payment_split").upsert({
      order_id: params.orderId,
      payment_id: params.paymentId,
      restaurant_id: params.restaurantId,
      provider: "mercadopago",
      restaurant_amount: 0,
      platform_amount: 0,
      gateway_fee: 0,
      status: "MANUAL_REVIEW",
      split_reference: `mp_payment:${params.paymentId}`,
      error_message: "pricing_snapshot_missing",
      metadata: {
        reason: "pricing_snapshot_missing",
        payment_id: params.paymentId,
        order_id: params.orderId,
        restaurant_id: params.restaurantId,
        checked_at: new Date().toISOString(),
      },
    }, { onConflict: "order_id" });
    return;
  }

  const expectedPlatformFee = roundMoney(Number(snapshot.platform_fee ?? 0));
  const baseRow = {
    order_id: params.orderId,
    payment_id: params.paymentId,
    restaurant_id: params.restaurantId,
    provider: "mercadopago",
    restaurant_amount: roundMoney(snapshot.restaurant_net),
    platform_amount: expectedPlatformFee,
    gateway_fee: roundMoney(snapshot.gateway_fee),
    split_reference: `mp_payment:${params.paymentId}`,
  };

  if (params.localStatus === "PENDING" || params.localStatus === "PROCESSING") {
    await sb.from("payment_split").upsert({
      ...baseRow,
      status: "PROCESSING",
      error_message: null,
      processed_at: null,
      metadata: {
        gateway_status: params.payment.status ?? null,
        expected_platform_fee: expectedPlatformFee,
        service_fee_payer: snapshot.service_fee_payer,
      },
    }, { onConflict: "order_id" });
    return;
  }

  if (params.localStatus === "REJECTED" || params.localStatus === "CANCELLED" || params.localStatus === "EXPIRED") {
    await sb.from("payment_split").upsert({
      ...baseRow,
      status: "FAILED",
      error_message: `payment_${params.localStatus.toLowerCase()}`,
      processed_at: new Date().toISOString(),
      metadata: {
        gateway_status: params.payment.status ?? null,
        expected_platform_fee: expectedPlatformFee,
        service_fee_payer: snapshot.service_fee_payer,
      },
    }, { onConflict: "order_id" });
    return;
  }

  if (params.localStatus === "CHARGEBACK") {
    await sb.from("payment_split").upsert({
      ...baseRow,
      status: "MANUAL_REVIEW",
      error_message: "split_chargeback_reconciliation_required",
      processed_at: null,
      metadata: {
        gateway_status: params.payment.status ?? null,
        gateway_status_detail: params.payment.status_detail ?? null,
        expected_platform_fee: expectedPlatformFee,
        service_fee_payer: snapshot.service_fee_payer,
        reason: "chargeback_dispute_requires_manual_review",
      },
    }, { onConflict: "order_id" });
    return;
  }

  if (expectedPlatformFee < 0 || expectedPlatformFee >= roundMoney(snapshot.customer_total)) {
    await sb.from("payment_split").upsert({
      ...baseRow,
      status: "MANUAL_REVIEW",
      error_message: "invalid_platform_fee",
      processed_at: null,
      metadata: {
        expected_platform_fee: expectedPlatformFee,
        customer_total: roundMoney(snapshot.customer_total),
        reason: "invalid_platform_fee",
      },
    }, { onConflict: "order_id" });
    return;
  }

  const refundReversal = calculateRefundReversal({
    localStatus: params.localStatus,
    paymentStatusDetail: String(params.payment.status_detail ?? ""),
    transactionAmount: roundMoney(snapshot.customer_total),
    expectedPlatformFee,
    payment: params.payment,
  });
  if (refundReversal) {
    if (!refundReversal.ok) {
      await sb.from("payment_split").upsert({
        ...baseRow,
        status: "MANUAL_REVIEW",
        error_message: refundReversal.reason,
        processed_at: null,
        metadata: {
          expected_platform_fee: expectedPlatformFee,
          customer_total: roundMoney(snapshot.customer_total),
          service_fee_payer: snapshot.service_fee_payer,
          gateway_status: params.payment.status ?? null,
          gateway_status_detail: params.payment.status_detail ?? null,
          reason: refundReversal.reason,
        },
      }, { onConflict: "order_id" });
      return;
    }

    const previousRealized = roundMoney(Number(snapshot.realized_platform_revenue ?? 0));
    const nextRealized = refundReversal.realizedPlatformRevenue;
    const ledgerDelta = roundMoney(nextRealized - previousRealized);
    await sb.from("payment_split").upsert({
      ...baseRow,
      status: "COMPLETED",
      error_message: null,
      processed_at: new Date().toISOString(),
      metadata: {
        expected_platform_fee: expectedPlatformFee,
        realized_platform_fee: nextRealized,
        reversed_platform_fee: refundReversal.reversedPlatformFee,
        refunded_amount: refundReversal.refundedAmount,
        reversal_status: refundReversal.reversalStatus,
        gateway_status: params.payment.status ?? null,
        gateway_status_detail: params.payment.status_detail ?? null,
        service_fee_payer: snapshot.service_fee_payer,
        checked_at: new Date().toISOString(),
      },
    }, { onConflict: "order_id" });

    const { error } = await sb
      .from("order_pricing_snapshot")
      .update({ realized_platform_revenue: nextRealized })
      .eq("order_id", params.orderId);
    if (error) console.error("[mp-webhook] realized platform revenue refund update failed", { orderId: params.orderId, error: error.message });

    if (ledgerDelta < 0) {
      await insertLedgerOnce(sb, {
        order_id: params.orderId,
        restaurant_id: params.restaurantId,
        provider: "mercado_pago",
        transaction_type: "PLATFORM_FEE_REVERSAL",
        amount: ledgerDelta,
        currency: String(params.payment.currency_id ?? "BRL"),
        status: "COMPLETED",
        reference_type: "mp_split_reversal",
        reference_id: `${params.paymentId}:${refundReversal.reversalStatus}:${refundReversal.refundedAmount}`,
        description: "Reversao da receita Localix por reembolso Mercado Pago",
        metadata: {
          payment_id: params.paymentId,
          order_id: params.orderId,
          restaurant_id: params.restaurantId,
          previous_realized_platform_revenue: previousRealized,
          realized_platform_revenue: nextRealized,
          reversed_platform_fee_delta: ledgerDelta,
          refund_reversal_status: refundReversal.reversalStatus,
        },
      });
    }
    return;
  }

  const extraction = expectedPlatformFee === 0
    ? { ok: true as const, amount: 0, source: "zero_expected" }
    : extractMarketplaceFee(params.payment);
  const matches = extraction.ok && Math.abs(extraction.amount - expectedPlatformFee) <= 0.01;
  const status = matches ? "COMPLETED" : "MANUAL_REVIEW";
  const errorMessage = matches ? null : extraction.ok ? "marketplace_fee_divergent" : `marketplace_fee_${extraction.reason}`;

  await sb.from("payment_split").upsert({
    ...baseRow,
    status,
    error_message: errorMessage,
    processed_at: matches ? new Date().toISOString() : null,
    metadata: {
      expected_platform_fee: expectedPlatformFee,
      realized_platform_fee: extraction.ok ? extraction.amount : null,
      marketplace_fee_source: extraction.ok ? extraction.source : null,
      payment_id: params.paymentId,
      order_id: params.orderId,
      restaurant_id: params.restaurantId,
      checked_at: new Date().toISOString(),
      reason: errorMessage,
    },
  }, { onConflict: "order_id" });

  if (matches) {
    const { error } = await sb
      .from("order_pricing_snapshot")
      .update({ realized_platform_revenue: extraction.amount })
      .eq("order_id", params.orderId);
    if (error) console.error("[mp-webhook] realized platform revenue update failed", { orderId: params.orderId, error: error.message });
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
  const eventType = String(body?.type ?? body?.topic ?? "").toLowerCase() || null;
  const action = String(body?.action ?? "").toLowerCase() || null;
  const dataIdFromBody = String(body?.data?.id ?? body?.resource ?? body?.id ?? "") || null;
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
      resource_id: resourceId,
    });
    await sb.from("payment_webhook_events").update({
      processed: false,
      error_message: `signature_invalid:${sigResult.reason ?? "unknown"}`,
      processing_attempts: 1,
    }).eq("id", eventPk);
    await sb.from("payment_event_queue").insert({
      event_id: eventPk,
      status: "pending",
      retry_count: 0,
      next_retry: null,
      last_error: `signature_invalid:${sigResult.reason ?? "unknown"}`,
    });
    return json({ ok: false, error: "webhook_signature_invalid" }, { status: 401 });
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
      .select("order_id, orders:order_id(id, restaurant_id)")
        .eq("payment_id", resourceId)
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

    const token = await getAccessTokenForOrder(sb, restaurantId);
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
