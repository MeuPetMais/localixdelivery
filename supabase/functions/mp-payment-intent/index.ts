// Mercado Pago â€” Payment Intent
// AÃ§Ãµes: create | status | cancel
// - Nunca expÃµe access token ao frontend.
// - CartÃ£o: prepara a estrutura (retorna { pending: true }); pagamento serÃ¡
//   implementado depois.
// - Pix: cria pagamento e retorna QR Code + copia-e-cola + expiraÃ§Ã£o.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { transitionOrder } from "../_shared/order-transition.ts";
import {
  getMercadoPagoCheckoutProUrl,
  getRequiredMpEnvironmentConfig,
  getRestaurantMpAccessToken,
  validateMercadoPagoAccountEnvironment,
} from "../_shared/mp-security.ts";

type MpStatus = "pending" | "in_process" | "approved" | "rejected" | "cancelled" | "refunded" | "charged_back";
type LocalStatus = "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "REFUNDED" | "CHARGEBACK";
type PricingSnapshot = {
  platform_fee: number;
  customer_total: number;
  restaurant_net: number;
  gateway_fee: number;
  service_fee_payer: string;
};

class MercadoPagoApiError extends Error {
  httpStatus: number;
  body: Record<string, unknown>;

  constructor(httpStatus: number, body: Record<string, unknown>) {
    const message = String(body?.message || body?.error || `MP error ${httpStatus}`);
    super(message);
    this.name = "MercadoPagoApiError";
    this.httpStatus = httpStatus;
    this.body = body;
  }
}

function mapStatus(s: string | null | undefined): LocalStatus {
  switch ((s ?? "").toLowerCase() as MpStatus) {
    case "approved": return "APPROVED";
    case "in_process": return "PROCESSING";
    case "rejected": return "REJECTED";
    case "cancelled": return "CANCELLED";
    case "refunded": return "REFUNDED";
    case "charged_back": return "CHARGEBACK";
    default: return "PENDING";
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateSplitAmounts(params: { transactionAmount: number; platformFee: number }) {
  const transactionAmount = roundMoney(Number(params.transactionAmount));
  const platformFee = roundMoney(Number(params.platformFee));
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) throw new Error("invalid_transaction_amount");
  if (!Number.isFinite(platformFee) || platformFee < 0) throw new Error("invalid_platform_fee");
  if (platformFee >= transactionAmount) throw new Error("platform_fee_greater_or_equal_total");
  return { transactionAmount, platformFee, feeForGateway: platformFee > 0 ? platformFee : null };
}

function buildMpIdempotencyKey(orderId: string, method: "pix" | "checkout_pro"): string {
  return `localix-mp-${method}-${orderId}`;
}

function sanitizeMpCause(cause: unknown) {
  if (!Array.isArray(cause)) return cause ?? null;
  return cause.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      code: row.code ?? null,
      description: row.description ?? null,
    };
  });
}

function logPixMercadoPagoRejection(input: {
  environment: string;
  orderId: string;
  restaurantId: string;
  error: MercadoPagoApiError;
  request: Record<string, unknown>;
}) {
  if (input.environment !== "staging") return;
  const body = input.error.body;
  console.error("[mp-payment-intent][pix] mercado pago rejected payment", {
    order_id: input.orderId,
    restaurant_id: input.restaurantId,
    http_status: input.error.httpStatus,
    mp_error: body.error ?? null,
    mp_message: body.message ?? input.error.message,
    mp_status: body.status ?? body.status_detail ?? null,
    mp_cause: sanitizeMpCause(body.cause),
    transaction_amount: input.request.transaction_amount ?? null,
    payment_method_id: input.request.payment_method_id ?? null,
    application_fee: input.request.application_fee ?? null,
    external_reference: input.request.external_reference ?? null,
    notification_url: input.request.notification_url ?? null,
    payer_email_present: Boolean((input.request.payer as { email?: unknown } | undefined)?.email),
  });
}

function sumRefundedAmount(payment: Record<string, unknown>): number {
  const refunds = Array.isArray(payment.refunds) ? payment.refunds : [];
  const fromRefunds = refunds.reduce((sum, refund) => {
    const amount = Number((refund as { amount?: unknown }).amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  if (fromRefunds > 0) return roundMoney(fromRefunds);
  const transactionDetailsRefunded = (payment.transaction_details as { refunded_amount?: unknown } | undefined)?.refunded_amount;
  const direct = Number(payment.refunded_amount ?? transactionDetailsRefunded ?? 0);
  return Number.isFinite(direct) && direct > 0 ? roundMoney(direct) : 0;
}

function validateRefundRequest(params: {
  paymentStatus: string;
  transactionAmount: number;
  alreadyRefundedAmount: number;
  requestedAmount?: number | null;
}) {
  const transactionAmount = roundMoney(Number(params.transactionAmount));
  const alreadyRefundedAmount = roundMoney(Number(params.alreadyRefundedAmount));
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) throw new Error("invalid_transaction_amount");
  if (!Number.isFinite(alreadyRefundedAmount) || alreadyRefundedAmount < 0 || alreadyRefundedAmount > transactionAmount) {
    throw new Error("invalid_refunded_amount");
  }
  if (params.paymentStatus.toLowerCase() !== "approved") throw new Error("invalid_payment_status_to_refund");
  const refundableAmount = roundMoney(transactionAmount - alreadyRefundedAmount);
  const full = params.requestedAmount === undefined || params.requestedAmount === null;
  const refundAmount = full ? refundableAmount : roundMoney(Number(params.requestedAmount));
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new Error("invalid_refund_amount");
  if (refundAmount > refundableAmount) throw new Error("refund_amount_exceeds");
  return { refundAmount, full: full || refundAmount === refundableAmount, refundableAmount };
}

function buildMpRefundIdempotencyKey(paymentId: string, alreadyRefundedAmount: number, refundAmount: number): string {
  return `localix-mp-refund-${paymentId}-${roundMoney(alreadyRefundedAmount)}-${roundMoney(refundAmount)}`;
}

function isInternalRefundAuthorized(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("authorization") ?? "";
  return Boolean(serviceKey) && auth === `Bearer ${serviceKey}`;
}

async function loadPricingSnapshot(sb: ReturnType<typeof admin>, orderId: string, restaurantId: string): Promise<PricingSnapshot> {
  const { data, error } = await sb
    .from("order_pricing_snapshot")
    .select("platform_fee, customer_total, restaurant_net, gateway_fee, service_fee_payer, orders!inner(restaurant_id)")
    .eq("order_id", orderId)
    .eq("orders.restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("pricing_snapshot_missing_or_restaurant_mismatch");
  return {
    platform_fee: Number(data.platform_fee ?? 0),
    customer_total: Number(data.customer_total ?? 0),
    restaurant_net: Number(data.restaurant_net ?? 0),
    gateway_fee: Number(data.gateway_fee ?? 0),
    service_fee_payer: String(data.service_fee_payer ?? "customer"),
  };
}

async function persistPaymentSplit(sb: ReturnType<typeof admin>, params: {
  orderId: string;
  restaurantId: string;
  paymentId: string | null;
  snapshot: PricingSnapshot;
  status: "PROCESSING" | "FAILED";
  splitReference: string | null;
  checkoutType: "checkout_pro" | "pix";
  errorMessage?: string | null;
  gatewayStatus?: string | null;
}) {
  const { platformFee } = validateSplitAmounts({
    transactionAmount: params.snapshot.customer_total,
    platformFee: params.snapshot.platform_fee,
  });
  await sb.from("payment_split").upsert({
    order_id: params.orderId,
    payment_id: params.paymentId,
    restaurant_id: params.restaurantId,
    provider: "mercadopago",
    restaurant_amount: roundMoney(params.snapshot.restaurant_net),
    platform_amount: platformFee,
    gateway_fee: roundMoney(params.snapshot.gateway_fee),
    status: params.status,
    split_reference: params.splitReference,
    error_message: params.errorMessage ?? null,
    processed_at: params.status === "FAILED" ? new Date().toISOString() : null,
    metadata: {
      checkout_type: params.checkoutType,
      expected_platform_fee: platformFee,
      service_fee_payer: params.snapshot.service_fee_payer,
      gateway_status: params.gatewayStatus ?? null,
    },
  }, { onConflict: "order_id" });
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getAccessToken(sb: ReturnType<typeof admin>, restaurantId: string): Promise<string> {
  const result = await getRestaurantMpAccessToken(sb as any, restaurantId, decryptToken);
  if (!result.ok) throw new Error(result.error);
  return result.token;
}

async function validatePaymentAccountEnvironment(
  sb: ReturnType<typeof admin>,
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

async function createPixPayment(token: string, params: {
  amount: number;
  applicationFee: number | null;
  description: string;
  externalReference: string;
  idempotencyKey: string;
  payerEmail: string;
  expirationDate: string;
  notificationUrl: string;
  callbackUrl?: string | null;
}) {
  const body: Record<string, unknown> = {
    transaction_amount: Number(params.amount.toFixed(2)),
    description: params.description,
    payment_method_id: "pix",
    external_reference: params.externalReference,
    date_of_expiration: params.expirationDate,
    notification_url: params.notificationUrl,
    payer: { email: params.payerEmail },
  };
  if (params.applicationFee !== null) {
    body.application_fee = Number(params.applicationFee.toFixed(2));
  }

  // O retorno automÃ¡tico do Mercado Pago para PIX usa callback_url.
  // Mantemos opcional para nÃ£o quebrar ambiente local sem HTTPS.
  if (params.callbackUrl && /^https:\/\/[^\s]+$/.test(params.callbackUrl)) {
    body.callback_url = params.callbackUrl;
  }

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const resBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new MercadoPagoApiError(res.status, resBody);
  }
  return resBody;
}
type MpPayer = {
  email?: string;
  name?: string;
  surname?: string;
  identification?: { type: string; number: string };
  phone?: { area_code: string; number: string };
  address?: {
    zip_code?: string;
    street_name?: string;
    street_number?: string;
    city?: string;
    state?: string;
  };
};

async function createCardPreference(token: string, params: {
  amount: number;
  marketplaceFee: number | null;
  orderNumber: string | number;
  externalReference: string;
  idempotencyKey: string;
  items: Array<{ title: string; quantity: number; unit_price: number }>;
  payer?: MpPayer | null;
  notificationUrl: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
}) {
  const body: Record<string, unknown> = {
    external_reference: params.externalReference,
    statement_descriptor: "LOCALIX",
    items: params.items.length > 0 ? params.items : [{
      title: `Pedido #${params.orderNumber}`,
      quantity: 1,
      currency_id: "BRL",
      unit_price: Number(params.amount.toFixed(2)),
    }],
    notification_url: params.notificationUrl,
    back_urls: {
      success: params.successUrl,
      failure: params.failureUrl,
      pending: params.pendingUrl,
    },
    auto_return: "approved",
    payment_methods: {
      excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }],
      excluded_payment_methods: [{ id: "pix" }, { id: "bolbradesco" }],
      installments: 12,
    },
    binary_mode: false,
  };
  if (params.marketplaceFee !== null) {
    body.marketplace_fee = Number(params.marketplaceFee.toFixed(2));
  }
  // Ensure currency_id on items
  (body.items as any[]).forEach((it) => { if (!it.currency_id) it.currency_id = "BRL"; });

  if (params.payer && Object.keys(params.payer).length > 0) {
    body.payer = params.payer;
  }


  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const resBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = resBody?.message || resBody?.error || `MP error ${res.status}`;
    throw new Error(msg);
  }
  return resBody;
}


async function getPayment(token: string, paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `MP error ${res.status}`);
  return body;
}

async function cancelPayment(token: string, paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ status: "cancelled" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `MP error ${res.status}`);
  return body;
}

async function createRefund(token: string, paymentId: string, params: {
  amount: number;
  full: boolean;
  idempotencyKey: string;
}) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: params.full ? "{}" : JSON.stringify({ amount: Number(params.amount.toFixed(2)) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || body?.error || `MP error ${res.status}`);
  return body;
}

async function syncOrderStatusFromPayment(orderId: string, status: LocalStatus, source: string, rawStatus?: string | null) {
  const target: Record<LocalStatus, string | null> = {
    APPROVED: "pago",
    REJECTED: "falha_pagamento",
    CANCELLED: "falha_pagamento",
    EXPIRED: "falha_pagamento",
    REFUNDED: "reembolsado",
    CHARGEBACK: "chargeback",
    PENDING: null,
    PROCESSING: null,
  };
  const to = target[status];
  if (!to) return;
  const correlationId = `${source}:${orderId}:${crypto.randomUUID()}`;
  const tr = await transitionOrder({
    orderId,
    to,
    reason: `mp:${status.toLowerCase()}`,
    actorType: "webhook",
    service: source,
    correlationId,
    metadata: { mp_status: rawStatus ?? status, fallback: "payment_intent_status" },
  });
  if (!tr.ok) {
    console.warn("[mp-payment-intent] order transition rejected", {
      orderId,
      correlationId,
      to,
      reason: tr.reason ?? tr.error,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action ?? "create");
    const orderId = String(payload?.order_id ?? "");
    if (!orderId) return json({ error: "order_id obrigatÃ³rio" }, { status: 400 });

    const sb = admin();

    // Carrega pedido + pagamento
    const { data: order, error: ordErr } = await sb
      .from("orders")
      .select("id, restaurant_id, order_number, total, customer_id, customer_name, customer_phone, address, items")
      .eq("id", orderId)
      .maybeSingle();
    if (ordErr) throw ordErr;
    if (!order) return json({ error: "Pedido nÃ£o encontrado" }, { status: 404 });

    const { data: existing } = await sb
      .from("order_payment")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    const method = String(payload?.payment_method ?? existing?.payment_method ?? "pix").toLowerCase();
    console.log("[mp-payment-intent] payment method selected", {
      order_id: orderId,
      restaurant_id: order.restaurant_id,
      payload_payment_method: payload?.payment_method ?? null,
      existing_payment_method: existing?.payment_method ?? null,
      method,
    });
    const environmentConfig = getRequiredMpEnvironmentConfig(Deno.env);
    if (!environmentConfig.ok) {
      console.error("[mp-payment-intent] environment not configured", {
        provider: "mercado_pago",
        order_id: orderId,
        restaurant_id: order.restaurant_id,
        payment_method: method,
        error: environmentConfig.error,
        reason: environmentConfig.reason,
        timestamp: new Date().toISOString(),
      });
      return json({ error: environmentConfig.error }, { status: 500 });
    }

    await validatePaymentAccountEnvironment(sb, order.restaurant_id, environmentConfig);
    const token = await getAccessToken(sb, order.restaurant_id);

    // ---------- CREATE ----------
    if (action === "create") {
      const snapshot = await loadPricingSnapshot(sb, orderId, order.restaurant_id);
      const splitAmounts = validateSplitAmounts({
        transactionAmount: snapshot.customer_total,
        platformFee: snapshot.platform_fee,
      });

      // CartÃ£o Online â€” Mercado Pago Checkout Pro (Preference + redirect).
      if (method !== "pix") {
        // 1) Garante linha em order_payment ANTES de chamar o MP.
        const { data: preUp, error: preErr } = await sb.from("order_payment").upsert({
          order_id: orderId,
          restaurant_id: order.restaurant_id,
          provider: "mercado_pago",
          payment_method: "credit_card",
          status: "PENDING",
          transaction_amount: splitAmounts.transactionAmount,
          external_reference: order.id,
          last_error: null,
        }, { onConflict: "order_id" }).select("id");
        if (preErr || !preUp || preUp.length === 0) {
          console.error("[mp-payment-intent] order_payment pre-upsert failed (card)", { orderId, error: preErr?.message, rows: preUp?.length ?? 0 });
          return json({ error: "order_payment_persist_failed" }, { status: 500 });
        }

        // 2) notification_url â€” mesma do PIX, compatÃ­vel com webhook existente.
        const notificationUrl = environmentConfig.webhookUrl;
       

        // 3) back_urls â€” auto_return exige HTTPS vÃ¡lido em success.
        const successUrl = String(payload?.success_url ?? "").trim();
        const cancelUrl = String(payload?.cancel_url ?? "").trim();
        if (!/^https:\/\/[^\s]+$/.test(successUrl) || !/^https:\/\/[^\s]+$/.test(cancelUrl)) {
          console.error("[mp-payment-intent] back_urls invÃ¡lidas (card)", { orderId, successUrl, cancelUrl });
          await sb.from("order_payment").update({ status: "PENDING", last_error: "back_urls_invalid" }).eq("order_id", orderId);
          return json({ error: "back_urls_invalid" }, { status: 400 });
        }

        // O total cobrado pelo Checkout Pro vem da soma dos itens da preference.
        const items: Array<{ title: string; quantity: number; unit_price: number }> = [];

        // --- Payer enriquecido (somente campos disponÃ­veis; nada de objeto vazio) ---
        const payloadEmail = String(payload?.payer_email ?? "").trim().toLowerCase();

        // Busca dados do cliente (email real + endereÃ§o padrÃ£o) quando disponÃ­vel.
        let custEmail: string | null = null;
        let custPhone: string | null = order.customer_phone ?? null;
        let custAddress: any = null;
        if (order.customer_id) {
          const { data: prof } = await sb
            .from("customer_profiles")
            .select("email, phone, whatsapp")
            .eq("id", order.customer_id)
            .maybeSingle();
          custEmail = prof?.email ?? null;
          custPhone = custPhone || prof?.phone || prof?.whatsapp || null;
          const { data: addr } = await sb
            .from("customer_addresses")
            .select("cep, street, number, city, state")
            .eq("customer_id", order.customer_id)
            .order("is_default", { ascending: false })
            .limit(1)
            .maybeSingle();
          custAddress = addr ?? null;
        }
        if (!custEmail) {
          const { data: cust } = await sb
            .from("customers")
            .select("email, phone")
            .eq("restaurant_id", order.restaurant_id)
            .eq("phone", order.customer_phone ?? "")
            .maybeSingle();
          custEmail = cust?.email ?? null;
          custPhone = custPhone || cust?.phone || null;
        }

        // Prioridade do e-mail: cadastrado > informado no checkout > sintÃ©tico.
        const finalEmail = (custEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(custEmail))
          ? custEmail
          : (payloadEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payloadEmail) ? payloadEmail : null);

        // Split nome/sobrenome.
        const fullName = String(order.customer_name ?? "").trim().replace(/\s+/g, " ");
        const parts = fullName ? fullName.split(" ") : [];
        const firstName = parts[0] ?? "";
        const lastName = parts.slice(1).join(" ");

        // CPF sÃ³ se veio no payload (nÃ£o temos coluna prÃ³pria).
        const rawCpf = String(payload?.payer_cpf ?? "").replace(/\D/g, "");
        const cpf = rawCpf.length === 11 ? rawCpf : "";

        // Telefone: preferir do payload; fallback para o telefone do cliente.
        const rawPhone = String(payload?.payer_phone ?? custPhone ?? "").replace(/\D/g, "");
        let phoneObj: { area_code: string; number: string } | undefined;
        if (rawPhone.length >= 10) {
          // formato BR: primeiros 2 dÃ­gitos = DDD (ignora prefixo 55 se presente)
          const local = rawPhone.startsWith("55") && rawPhone.length > 11 ? rawPhone.slice(2) : rawPhone;
          if (local.length >= 10) {
            phoneObj = { area_code: local.slice(0, 2), number: local.slice(2) };
          }
        }

        // EndereÃ§o estruturado (payload > custAddress).
        const payloadAddr = payload?.payer_address ?? null;
        const addrSrc = payloadAddr && typeof payloadAddr === "object" ? payloadAddr : custAddress;
        let addressObj: MpPayer["address"] | undefined;
        if (addrSrc) {
          const zip = String(addrSrc.zip_code ?? addrSrc.cep ?? "").replace(/\D/g, "");
          const street = String(addrSrc.street_name ?? addrSrc.street ?? "").trim();
          const number = String(addrSrc.street_number ?? addrSrc.number ?? "").trim();
          const city = String(addrSrc.city ?? "").trim();
          const state = String(addrSrc.state ?? "").trim();
          const partial: Record<string, string> = {};
          if (zip) partial.zip_code = zip;
          if (street) partial.street_name = street;
          if (number) partial.street_number = number;
          if (city) partial.city = city;
          if (state) partial.state = state;
          if (Object.keys(partial).length > 0) addressObj = partial as MpPayer["address"];
        }

        const payer: MpPayer = {};
        if (finalEmail) payer.email = finalEmail;
        if (firstName) payer.name = firstName;
        if (lastName) payer.surname = lastName;
        if (cpf) payer.identification = { type: "CPF", number: cpf };
        if (phoneObj) payer.phone = phoneObj;
        if (addressObj) payer.address = addressObj;

        console.log("[mp-payment-intent] creating card preference", {
          order_id: orderId,
          external_reference: order.id,
          notification_url: notificationUrl,
          environment: environmentConfig.runtimeEnvironment,
          mp_environment: environmentConfig.mercadoPagoEnvironment,
          items_count: items.length,
          amount: splitAmounts.transactionAmount,
          expected_platform_fee: splitAmounts.platformFee,
          service_fee_payer: snapshot.service_fee_payer,
          payer_fields: Object.keys(payer),
        });

        // 5) Cria a Preference no Checkout Pro.
        let pref;
        try {
          pref = await createCardPreference(token, {
            amount: splitAmounts.transactionAmount,
            marketplaceFee: splitAmounts.feeForGateway,
            orderNumber: order.order_number ?? order.id,
            externalReference: order.id,
            idempotencyKey: buildMpIdempotencyKey(orderId, "checkout_pro"),
            items,
            payer: Object.keys(payer).length > 0 ? payer : null,
            notificationUrl,
            successUrl,
            failureUrl: cancelUrl,
            pendingUrl: cancelUrl,
          });

        } catch (e) {
          const msg = String((e as Error).message ?? e);
          console.error("[mp-payment-intent] preference create failed", { orderId, error: msg });
          await sb.from("order_payment").update({ status: "PENDING", last_error: msg }).eq("order_id", orderId);
          await persistPaymentSplit(sb, {
            orderId,
            restaurantId: order.restaurant_id,
            paymentId: null,
            snapshot,
            status: "FAILED",
            splitReference: null,
            checkoutType: "checkout_pro",
            errorMessage: msg,
          });
          return json({ error: msg }, { status: 502 });
        }

        // 6) init_point (produÃ§Ã£o) ou sandbox_init_point (sandbox).
        const paymentUrl = getMercadoPagoCheckoutProUrl(pref, environmentConfig);
        if (!paymentUrl) {
          console.error("[mp-payment-intent] preference sem init_point", { orderId, pref_id: pref?.id });
          await sb.from("order_payment").update({ status: "PENDING", last_error: "preference_missing_init_point" }).eq("order_id", orderId);
          return json({ error: "preference_missing_init_point" }, { status: 502 });
        }

        // 7) Persiste preference_id e URL (compatÃ­vel com webhook: lookup por external_reference).
        const { error: postErr } = await sb.from("order_payment").upsert({
          order_id: orderId,
          restaurant_id: order.restaurant_id,
          provider: "mercado_pago",
          payment_method: "credit_card",
          payment_id: String(pref.id),
          external_reference: order.id,
          status: "PENDING",
          transaction_amount: splitAmounts.transactionAmount,
          payment_url: paymentUrl,
          last_error: null,
        }, { onConflict: "order_id" }).select("id");
        if (postErr) {
          console.error("[mp-payment-intent] order_payment post-upsert failed (card)", { orderId, error: postErr.message });
          return json({ error: "order_payment_persist_failed" }, { status: 500 });
        }

        await persistPaymentSplit(sb, {
          orderId,
          restaurantId: order.restaurant_id,
          paymentId: String(pref.id),
          snapshot,
          status: "PROCESSING",
          splitReference: `mp_preference:${pref.id}`,
          checkoutType: "checkout_pro",
          gatewayStatus: "preference_created",
        });

        return json({
          pending: false,
          payment_id: String(pref.id),
          status: "PENDING",
          payment_url: paymentUrl,
        });
      }



      // PIX â€” requer payer_email real; sem fallback fictÃ­cio.
      const payerEmail = String(payload?.payer_email ?? "").trim().toLowerCase();
      if (!payerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payerEmail)) {
        return json({ error: "payer_email_required" }, { status: 400 });
      }

      // Garante linha em order_payment ANTES de chamar o MP.
      const { data: preUp, error: preErr } = await sb.from("order_payment").upsert({
        order_id: orderId,
        restaurant_id: order.restaurant_id,
        provider: "mercado_pago",
        payment_method: "pix",
        status: "PENDING",
        transaction_amount: splitAmounts.transactionAmount,
        external_reference: order.id,
        last_error: null,
      }, { onConflict: "order_id" }).select("id");
      if (preErr || !preUp || preUp.length === 0) {
        console.error("[mp-payment-intent] order_payment pre-upsert failed", { orderId, error: preErr?.message, rows: preUp?.length ?? 0 });
        return json({ error: "order_payment_persist_failed" }, { status: 500 });
      }

      const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const callbackUrl = String(payload?.success_url ?? "").trim();

     // notification_url â€” obrigatÃ³rio para receber webhook do MP.
      const notificationUrl = environmentConfig.webhookUrl;

      console.log("[mp-payment-intent] creating pix", {
        environment: environmentConfig.runtimeEnvironment,
        mp_environment: environmentConfig.mercadoPagoEnvironment,
        restaurant_id: order.restaurant_id,
        order_id: orderId,
        external_reference: order.id,
        notification_url: notificationUrl,
        callback_url: /^https:\/\/[^\s]+$/.test(callbackUrl) ? callbackUrl : null,
        payment_method: "pix",
        transaction_amount: splitAmounts.transactionAmount,
        expected_platform_fee: splitAmounts.platformFee,
        service_fee_payer: snapshot.service_fee_payer,
      });

      let mp;
      const pixPaymentRequestForDiagnostics = {
        transaction_amount: splitAmounts.transactionAmount,
        payment_method_id: "pix",
        application_fee: splitAmounts.feeForGateway,
        external_reference: order.id,
        notification_url: notificationUrl,
        payer: { email: payerEmail },
      };
      try {
        mp = await createPixPayment(token, {
          amount: splitAmounts.transactionAmount,
          applicationFee: splitAmounts.feeForGateway,
          description: `Pedido #${order.order_number ?? order.id}`,
          externalReference: order.id,
          idempotencyKey: buildMpIdempotencyKey(orderId, "pix"),
          payerEmail,
          expirationDate: expiration,
          notificationUrl,
          callbackUrl,
        });
      } catch (e) {
        if (e instanceof MercadoPagoApiError) {
          logPixMercadoPagoRejection({
            environment: environmentConfig.runtimeEnvironment,
            orderId,
            restaurantId: order.restaurant_id,
            error: e,
            request: pixPaymentRequestForDiagnostics,
          });
        }
        await sb.from("order_payment").update({
          status: "PENDING",
          last_error: String((e as Error).message ?? e),
        }).eq("order_id", orderId);
        await persistPaymentSplit(sb, {
          orderId,
          restaurantId: order.restaurant_id,
          paymentId: null,
          snapshot,
          status: "FAILED",
          splitReference: null,
          checkoutType: "pix",
          errorMessage: String((e as Error).message ?? e),
        });
        return json({ error: String((e as Error).message ?? e) }, { status: 502 });
      }


      const qr = mp?.point_of_interaction?.transaction_data ?? {};
      const status = mapStatus(mp?.status);
      const ticketUrl = mp?.point_of_interaction?.transaction_data?.ticket_url
        ?? mp?.transaction_details?.external_resource_url
        ?? null;

      // Valida notification_url no response do MP â€” sem ela nÃ£o devolvemos ticket_url.
      const returnedNotifUrl = String(mp?.notification_url ?? "").trim();
      if (!returnedNotifUrl || returnedNotifUrl !== notificationUrl) {
        console.error("[mp-payment-intent] notification_url ausente/divergente no response MP", {
          orderId, mpId: String(mp?.id ?? ""), sent: notificationUrl, received: returnedNotifUrl,
        });
        try { await cancelPayment(token, String(mp.id)); } catch (_) { /* ignore */ }
        await sb.from("order_payment").update({
          status: "CANCELLED",
          last_error: "notification_url_missing_in_response",
        }).eq("order_id", orderId);
        return json({ error: "notification_url_missing_in_response" }, { status: 500 });
      }


      const { data: postUp, error: postErr } = await sb.from("order_payment").upsert({
        order_id: orderId,
        restaurant_id: order.restaurant_id,
        provider: "mercado_pago",
        payment_method: "pix",
        payment_id: String(mp.id),
        payment_intent: String(mp.id),
        external_reference: order.id,
        status,
        transaction_amount: Number(mp?.transaction_amount ?? splitAmounts.transactionAmount),
        expiration_date: mp?.date_of_expiration ?? expiration,
        qr_code: qr.qr_code ?? null,
        qr_code_base64: qr.qr_code_base64 ?? null,
        payment_url: ticketUrl,
        last_error: null,
      }, { onConflict: "order_id" }).select("id");

      if (postErr || !postUp || postUp.length === 0) {
        console.error("[mp-payment-intent] order_payment post-upsert failed", { orderId, mpId: String(mp.id), error: postErr?.message, rows: postUp?.length ?? 0 });
        return json({ error: "order_payment_persist_failed" }, { status: 500 });
      }

      await syncOrderStatusFromPayment(orderId, status, "mp-payment-intent:create", mp?.status ?? null);

      await persistPaymentSplit(sb, {
        orderId,
        restaurantId: order.restaurant_id,
        paymentId: String(mp.id),
        snapshot,
        status: "PROCESSING",
        splitReference: `mp_payment:${mp.id}`,
        checkoutType: "pix",
        gatewayStatus: mp?.status ?? null,
      });

      // TambÃ©m popula `payments` (mesmo schema que Stripe) para consistÃªncia cross-gateway.
      const { error: payErr } = await sb.from("payments").upsert({
        order_id: orderId,
        restaurant_id: order.restaurant_id,
        provider: "mercado_pago",
        external_id: String(mp.id),
        method: "pix",
        status: status.toLowerCase(),
        amount: Number(mp?.transaction_amount ?? splitAmounts.transactionAmount),
        currency: mp?.currency_id ?? "BRL",
        qr_code: qr.qr_code ?? null,
        qr_code_base64: qr.qr_code_base64 ?? null,
        ticket_url: ticketUrl,
        payer_email: payerEmail,
        raw: mp,
      }, { onConflict: "provider,external_id" });
      if (payErr) console.error("[mp-payment-intent] payments upsert failed", { orderId, error: payErr.message });

      return json({
        payment_id: String(mp.id),
        status,
        qr_code: qr.qr_code ?? null,
        qr_code_base64: qr.qr_code_base64 ?? null,
        payment_url: ticketUrl,
        callback_url: /^https:\/\/[^\s]+$/.test(callbackUrl) ? callbackUrl : null,
        expiration_date: mp?.date_of_expiration ?? expiration,
      });
    }


    // ---------- STATUS ----------
    if (action === "status") {
      if (!existing?.payment_id) return json({ status: existing?.status ?? "PENDING" });
      const mp = await getPayment(token, existing.payment_id);
      const status = mapStatus(mp?.status);

      // Detecta expiraÃ§Ã£o pela data se MP nÃ£o devolveu status cancelado
      let finalStatus: LocalStatus = status;
      if (status === "PENDING" && existing.expiration_date && new Date(existing.expiration_date) < new Date()) {
        finalStatus = "EXPIRED";
      }

      await sb.from("order_payment").update({ status: finalStatus }).eq("order_id", orderId);
      await syncOrderStatusFromPayment(orderId, finalStatus, "mp-payment-intent:status", mp?.status ?? null);
      return json({ status: finalStatus, payment_id: existing.payment_id, raw_status: mp?.status });
    }

    // ---------- REFUND ----------
    if (action === "refund") {
      if (!isInternalRefundAuthorized(req)) {
        return json({ error: "refund_forbidden" }, { status: 403 });
      }
      if (!existing?.payment_id) return json({ error: "payment_id_missing" }, { status: 409 });
      const mp = await getPayment(token, existing.payment_id);
      const transactionAmount = roundMoney(Number(mp?.transaction_amount ?? existing?.transaction_amount ?? order.total));
      const alreadyRefundedAmount = sumRefundedAmount(mp);
      const requestedAmountRaw = payload?.amount ?? payload?.refund_amount ?? null;
      const requestedAmount = requestedAmountRaw === null || requestedAmountRaw === undefined
        ? null
        : Number(requestedAmountRaw);
      const refundPlan = validateRefundRequest({
        paymentStatus: String(mp?.status ?? ""),
        transactionAmount,
        alreadyRefundedAmount,
        requestedAmount,
      });
      const idempotencyKey = String(payload?.idempotency_key ?? "").trim()
        || buildMpRefundIdempotencyKey(String(existing.payment_id), alreadyRefundedAmount, refundPlan.refundAmount);

      let refund;
      try {
        refund = await createRefund(token, String(existing.payment_id), {
          amount: refundPlan.refundAmount,
          full: refundPlan.full,
          idempotencyKey,
        });
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        await sb.from("order_payment").update({ last_error: msg }).eq("order_id", orderId);
        return json({ error: msg }, { status: 502 });
      }

      await sb.from("order_payment").update({
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("order_id", orderId);

      console.log("[mp-payment-intent] refund requested", {
        order_id: orderId,
        restaurant_id: order.restaurant_id,
        payment_id: String(existing.payment_id),
        amount: refundPlan.refundAmount,
        full: refundPlan.full,
      });

      return json({
        ok: true,
        status: "REFUND_REQUESTED",
        payment_id: String(existing.payment_id),
        refund_id: String(refund?.id ?? ""),
        refund_amount: refundPlan.refundAmount,
        full: refundPlan.full,
      });
    }

    // ---------- CANCEL ----------
    if (action === "cancel") {
      if (!existing?.payment_id) {
        await sb.from("order_payment").update({ status: "CANCELLED" }).eq("order_id", orderId);
        return json({ status: "CANCELLED" });
      }
      try {
        await cancelPayment(token, existing.payment_id);
      } catch (_) { /* pode jÃ¡ estar finalizado */ }
      await sb.from("order_payment").update({ status: "CANCELLED" }).eq("order_id", orderId);
      return json({ status: "CANCELLED" });
    }

    return json({ error: "AÃ§Ã£o invÃ¡lida" }, { status: 400 });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    console.error("[mp-payment-intent]", msg);
    if (
      msg === "restaurant_mp_not_connected" ||
      msg === "restaurant_mp_token_invalid" ||
      msg === "restaurant_mp_token_expired" ||
      msg === "mercadopago_account_not_allowed_in_staging" ||
      msg === "mercadopago_staging_seller_allowlist_not_configured"
    ) {
      return json({ error: msg }, { status: 409 });
    }
    if (msg === "pricing_snapshot_missing_or_restaurant_mismatch") {
      return json({ error: msg }, { status: 409 });
    }
    if (
      msg === "invalid_transaction_amount" ||
      msg === "invalid_platform_fee" ||
      msg === "platform_fee_greater_or_equal_total"
    ) {
      return json({ error: msg }, { status: 422 });
    }
    return json({ error: msg }, { status: 500 });
  }
});
