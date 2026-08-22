// Mercado Pago — Payment Intent
// Ações: create | status | cancel
// - Nunca expõe access token ao frontend.
// - Cartão: prepara a estrutura (retorna { pending: true }); pagamento será
//   implementado depois.
// - Pix: cria pagamento e retorna QR Code + copia-e-cola + expiração.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { transitionOrder } from "../_shared/order-transition.ts";
function mapStatus(s) {
  switch ((s ?? "").toLowerCase()) {
    case "approved":
      return "APPROVED";
    case "in_process":
      return "PROCESSING";
    case "rejected":
      return "REJECTED";
    case "cancelled":
      return "CANCELLED";
    case "refunded":
    case "charged_back":
      return "APPROVED";
    default:
      return "PENDING";
  }
}
function admin() {
  return createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
async function getAccessToken(sb, restaurantId) {
  const { data } = await sb
    .from("mercado_pago_accounts")
    .select("access_token, connected")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!data?.connected || !data.access_token) {
    throw new Error("mercado_pago_seller_not_connected");
  }
  const token = await decryptToken(data.access_token);
  if (!token) throw new Error("mercado_pago_seller_not_connected");
  return token;
}
function sanitizeMpCause(cause) {
  if (!Array.isArray(cause)) return undefined;
  return cause
    .filter((item) => !!item && typeof item === "object")
    .map((item) => {
      const sanitized = {};
      if ("code" in item) sanitized.code = item.code;
      if ("description" in item) sanitized.description = item.description;
      if ("data" in item) sanitized.data = item.data;
      return sanitized;
    });
}
function sanitizeMpPaymentError(httpStatus, body) {
  const source = body && typeof body === "object" ? body : {};
  const sanitized = {
    http_status: httpStatus,
  };
  if ("message" in source) sanitized.message = source.message;
  if ("error" in source) sanitized.error = source.error;
  if ("status" in source) sanitized.status = source.status;
  if ("code" in source) sanitized.code = source.code;
  const cause = sanitizeMpCause(source.cause);
  if (cause) sanitized.cause = cause;
  return sanitized;
}
function serializeMpPaymentError(httpStatus, body) {
  return JSON.stringify(sanitizeMpPaymentError(httpStatus, body));
}
async function createPixPayment(token, params) {
  const body = {
    transaction_amount: Number(params.amount.toFixed(2)),
    application_fee: Number(params.platformFee.toFixed(2)),
    description: params.description,
    payment_method_id: "pix",
    external_reference: params.externalReference,
    date_of_expiration: params.expirationDate,
    notification_url: params.notificationUrl,
    payer: {
      email: params.payerEmail,
    },
  };
  // O retorno automático do Mercado Pago para PIX usa callback_url.
  // Mantemos opcional para não quebrar ambiente local sem HTTPS.
  if (params.callbackUrl && /^https:\/\/[^\s]+$/.test(params.callbackUrl)) {
    body.callback_url = params.callbackUrl;
  }
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const resBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(serializeMpPaymentError(res.status, resBody));
  }
  return resBody;
}
async function hashShort(value) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
async function buildCardIdempotencyKey(orderId, cardToken) {
  return `localix-card-${orderId}-${await hashShort(cardToken)}`.slice(0, 64);
}
async function buildRefundIdempotencyKey(orderId, paymentId) {
  return `localix-refund-${await hashShort(`${orderId}:${paymentId}:full`)}`.slice(0, 64);
}
function getPayloadCard(payload) {
  const card = payload?.card && typeof payload.card === "object" ? payload.card : null;
  if (!card) throw new Error("card_payload_required");
  const token = String(card.token ?? "").trim();
  const paymentMethodId = String(card.payment_method_id ?? card.paymentMethodId ?? "").trim();
  const installments = Number(card.installments);
  const issuerIdRaw = String(card.issuer_id ?? card.issuerId ?? "").trim();
  if (!token) throw new Error("card_token_required");
  if (!paymentMethodId) throw new Error("card_payment_method_required");
  if (!Number.isInteger(installments) || installments <= 0)
    throw new Error("card_installments_required");
  const payer = card.payer && typeof card.payer === "object" ? card.payer : {};
  const identificationType = String(
    payer.identification_type ?? payer.identificationType ?? "",
  ).trim();
  const identificationNumber = String(
    payer.identification_number ?? payer.identificationNumber ?? "",
  ).replace(/\D/g, "");
  return {
    token,
    paymentMethodId,
    installments,
    issuerId: issuerIdRaw && /^\d+$/.test(issuerIdRaw) ? issuerIdRaw : null,
    payerIdentification:
      identificationType && identificationNumber
        ? {
            type: identificationType,
            number: identificationNumber,
          }
        : null,
  };
}
function sanitizeMpPaymentRaw(mp) {
  const raw = {};
  for (const key of [
    "id",
    "status",
    "status_detail",
    "transaction_amount",
    "currency_id",
    "payment_method_id",
    "payment_type_id",
    "external_reference",
    "collector_id",
    "operation_type",
    "date_created",
    "date_approved",
    "notification_url",
    "application_fee",
  ]) {
    if (key in (mp ?? {})) raw[key] = mp[key];
  }
  if (mp?.payer && typeof mp.payer === "object") {
    raw.payer = {
      id: mp.payer.id ?? null,
      type: mp.payer.type ?? null,
    };
  }
  if (Array.isArray(mp?.fee_details)) raw.fee_details = mp.fee_details;
  if (Array.isArray(mp?.charges_details)) raw.charges_details = mp.charges_details;
  return raw;
}
function sanitizeMpRefundRaw(refund) {
  const raw = {};
  for (const key of [
    "id",
    "payment_id",
    "amount",
    "status",
    "source",
    "date_created",
    "unique_sequence_number",
  ]) {
    if (key in (refund ?? {})) raw[key] = refund[key];
  }
  if (refund?.metadata && typeof refund.metadata === "object") raw.metadata = refund.metadata;
  return raw;
}
async function createTransparentCardPayment(token, params) {
  const body = {
    transaction_amount: Number(params.amount.toFixed(2)),
    token: params.card.token,
    description: params.description,
    installments: params.card.installments,
    payment_method_id: params.card.paymentMethodId,
    external_reference: params.externalReference,
    notification_url: params.notificationUrl,
    application_fee: Number(params.platformFee.toFixed(2)),
    payer: {
      email: params.payerEmail,
    },
  };
  if (params.card.issuerId) body.issuer_id = params.card.issuerId;
  if (params.card.payerIdentification) {
    body.payer.identification = params.card.payerIdentification;
  }
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const resBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(serializeMpPaymentError(res.status, resBody));
  }
  return resBody;
}
function toMoney(value) {
  return Number(value.toFixed(2));
}
function readSnapshotMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return toMoney(amount);
}
function buildCardPreferenceFinancials(snapshot, orderNumber) {
  const customerTotal = readSnapshotMoney(snapshot.customer_total);
  const platformFee = readSnapshotMoney(snapshot.platform_fee);
  const serviceFeePayer = String(snapshot.service_fee_payer ?? "");
  if (customerTotal === null || customerTotal <= 0) {
    throw new Error("invalid_card_customer_total");
  }
  if (platformFee === null || platformFee < 0) {
    throw new Error("invalid_card_platform_fee");
  }
  if (serviceFeePayer !== "customer" && serviceFeePayer !== "restaurant") {
    throw new Error("invalid_card_service_fee_payer");
  }
  return {
    customerTotal,
    platformFee,
    serviceFeePayer,
    items: [
      {
        title: `Pedido #${orderNumber}`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: customerTotal,
      },
    ],
  };
}
async function createCardPreference(token, params) {
  const body = {
    external_reference: params.externalReference,
    statement_descriptor: "LOCALIX",
    items: params.items,
    notification_url: params.notificationUrl,
    back_urls: {
      success: params.successUrl,
      failure: params.failureUrl,
      pending: params.pendingUrl,
    },
    auto_return: "approved",
    payment_methods: {
      excluded_payment_types: [
        {
          id: "ticket",
        },
        {
          id: "atm",
        },
        {
          id: "bank_transfer",
        },
      ],
      excluded_payment_methods: [
        {
          id: "pix",
        },
        {
          id: "bolbradesco",
        },
      ],
      installments: 12,
    },
    binary_mode: false,
  };
  if (params.platformFee > 0) {
    body.marketplace_fee = params.platformFee;
  }
  if (params.payer && Object.keys(params.payer).length > 0) {
    body.payer = params.payer;
  }
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Idempotency-Key": crypto.randomUUID(),
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
async function getPayment(token, paymentId) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `MP error ${res.status}`);
  return body;
}
async function cancelPayment(token, paymentId) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: "cancelled",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `MP error ${res.status}`);
  return body;
}
async function createPaymentRefund(token, paymentId, idempotencyKey) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serializeMpPaymentError(res.status, body));
  return body;
}
async function syncOrderStatusFromPayment(orderId, status, source, rawStatus) {
  const target = {
    APPROVED: "pago",
    REJECTED: "falha_pagamento",
    CANCELLED: "falha_pagamento",
    EXPIRED: "falha_pagamento",
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
    metadata: {
      mp_status: rawStatus ?? status,
      fallback: "payment_intent_status",
    },
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
  if (req.method === "OPTIONS")
    return new Response(null, {
      headers: corsHeaders,
    });
  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action ?? "create");
    const orderId = String(payload?.order_id ?? "");
    if (!orderId)
      return json(
        {
          error: "order_id obrigatório",
        },
        {
          status: 400,
        },
      );
    const sb = admin();
    // Carrega pedido + pagamento
    const { data: order, error: ordErr } = await sb
      .from("orders")
      .select(
        "id, restaurant_id, order_number, total, customer_id, customer_name, customer_phone, address, items, status",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (ordErr) throw ordErr;
    if (!order)
      return json(
        {
          error: "Pedido não encontrado",
        },
        {
          status: 404,
        },
      );
    const { data: existing } = await sb
      .from("order_payment")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    console.log("[mp-payment-intent] create/status request", {
      action,
      order_id: orderId,
      payload_payment_method: payload?.payment_method ?? null,
      existing_payment_method: existing?.payment_method ?? null,
      existing_status: existing?.status ?? null,
    });
    const method = String(
      payload?.payment_method ?? existing?.payment_method ?? "pix",
    ).toLowerCase();
    const token = await getAccessToken(sb, order.restaurant_id);
    // ---------- CREATE ----------
    if (action === "create") {
      // Cartão Online — Mercado Pago Checkout Pro (Preference + redirect).
      if (method !== "pix") {
        const { data: cardSnapshot, error: cardSnapshotErr } = await sb
          .from("order_pricing_snapshot")
          .select("customer_total, platform_fee, service_fee_payer")
          .eq("order_id", orderId)
          .maybeSingle();
        if (cardSnapshotErr) throw cardSnapshotErr;
        if (!cardSnapshot) {
          console.error("[mp-payment-intent] pricing snapshot ausente (card)", {
            orderId,
          });
          return json(
            {
              error: "missing_card_pricing_snapshot",
            },
            {
              status: 409,
            },
          );
        }
        let cardFinancials;
        try {
          cardFinancials = buildCardPreferenceFinancials(
            cardSnapshot,
            order.order_number ?? order.id,
          );
        } catch (e) {
          const msg = String(e.message ?? e);
          console.error("[mp-payment-intent] pricing snapshot invalido (card)", {
            orderId,
            error: msg,
          });
          return json(
            {
              error: msg,
            },
            {
              status: 409,
            },
          );
        }
        let transparentCard;
        try {
          transparentCard = getPayloadCard(payload);
        } catch (e) {
          return json(
            {
              error: String(e.message ?? e),
            },
            {
              status: 400,
            },
          );
        }
        const transparentPayerEmail = String(payload?.payer_email ?? "")
          .trim()
          .toLowerCase();
        if (!transparentPayerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(transparentPayerEmail)) {
          return json(
            {
              error: "payer_email_required",
            },
            {
              status: 400,
            },
          );
        }
        const { data: transparentPreUp, error: transparentPreErr } = await sb
          .from("order_payment")
          .upsert(
            {
              order_id: orderId,
              restaurant_id: order.restaurant_id,
              provider: "mercado_pago",
              payment_method: "credit_card",
              status: "PENDING",
              transaction_amount: cardFinancials.customerTotal,
              external_reference: order.id,
              payment_url: null,
              last_error: null,
            },
            {
              onConflict: "order_id",
            },
          )
          .select("id");
        if (transparentPreErr || !transparentPreUp || transparentPreUp.length === 0) {
          console.error("[mp-payment-intent] order_payment pre-upsert failed (transparent card)", {
            orderId,
            error: transparentPreErr?.message,
            rows: transparentPreUp?.length ?? 0,
          });
          return json(
            {
              error: "order_payment_persist_failed",
            },
            {
              status: 500,
            },
          );
        }
        const transparentNotificationUrl =
          "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1/mp-webhook";
        const transparentIdempotencyKey = await buildCardIdempotencyKey(
          orderId,
          transparentCard.token,
        );
        console.log("[mp-payment-intent] creating transparent card payment", {
          order_id: orderId,
          external_reference: order.id,
          notification_url: transparentNotificationUrl,
          amount: cardFinancials.customerTotal,
          application_fee: cardFinancials.platformFee,
          service_fee_payer: cardFinancials.serviceFeePayer,
          payment_method_id: transparentCard.paymentMethodId,
          installments: transparentCard.installments,
          issuer_id_present: !!transparentCard.issuerId,
          payer_identification_present: !!transparentCard.payerIdentification,
        });
        let transparentMp;
        try {
          transparentMp = await createTransparentCardPayment(token, {
            amount: cardFinancials.customerTotal,
            platformFee: cardFinancials.platformFee,
            description: `Pedido #${order.order_number ?? order.id}`,
            externalReference: order.id,
            notificationUrl: transparentNotificationUrl,
            payerEmail: transparentPayerEmail,
            card: transparentCard,
            idempotencyKey: transparentIdempotencyKey,
          });
        } catch (e) {
          const msg = String(e.message ?? e);
          console.error("[mp-payment-intent] transparent card create failed", {
            orderId,
            error: msg,
          });
          await sb
            .from("order_payment")
            .update({
              status: "PENDING",
              last_error: msg,
            })
            .eq("order_id", orderId);
          return json(
            {
              error: msg,
            },
            {
              status: 502,
            },
          );
        }
        const transparentStatus = mapStatus(transparentMp?.status);
        const transparentRaw = sanitizeMpPaymentRaw(transparentMp);
        const { error: transparentPostErr } = await sb
          .from("order_payment")
          .upsert(
            {
              order_id: orderId,
              restaurant_id: order.restaurant_id,
              provider: "mercado_pago",
              payment_method: "credit_card",
              payment_id: String(transparentMp.id),
              payment_intent: String(transparentMp.id),
              external_reference: order.id,
              status: transparentStatus,
              transaction_amount: Number(
                transparentMp?.transaction_amount ?? cardFinancials.customerTotal,
              ),
              payment_url: null,
              last_error:
                transparentStatus === "REJECTED"
                  ? JSON.stringify({
                      status: transparentMp?.status ?? null,
                      status_detail: transparentMp?.status_detail ?? null,
                    })
                  : null,
            },
            {
              onConflict: "order_id",
            },
          )
          .select("id");
        if (transparentPostErr) {
          console.error("[mp-payment-intent] order_payment post-upsert failed (transparent card)", {
            orderId,
            error: transparentPostErr.message,
          });
          return json(
            {
              error: "order_payment_persist_failed",
            },
            {
              status: 500,
            },
          );
        }
        const { error: transparentPaymentErr } = await sb.from("payments").upsert(
          {
            order_id: orderId,
            restaurant_id: order.restaurant_id,
            provider: "mercado_pago",
            external_id: String(transparentMp.id),
            method: "card",
            status: transparentStatus.toLowerCase(),
            amount: Number(transparentMp?.transaction_amount ?? cardFinancials.customerTotal),
            currency: transparentMp?.currency_id ?? "BRL",
            payer_email: transparentPayerEmail,
            paid_at: null,
            raw: transparentRaw,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "provider,external_id",
          },
        );
        if (transparentPaymentErr)
          console.error("[mp-payment-intent] payments upsert failed (transparent card)", {
            orderId,
            mpId: String(transparentMp.id),
            error: transparentPaymentErr.message,
          });
        return json({
          pending: false,
          payment_id: String(transparentMp.id),
          status: transparentStatus,
          payment_url: null,
          status_detail: transparentMp?.status_detail ?? null,
        });
        // 1) Garante linha em order_payment ANTES de chamar o MP.
        const { data: preUp, error: preErr } = await sb
          .from("order_payment")
          .upsert(
            {
              order_id: orderId,
              restaurant_id: order.restaurant_id,
              provider: "mercado_pago",
              payment_method: "credit_card",
              status: "PENDING",
              transaction_amount: cardFinancials.customerTotal,
              external_reference: order.id,
              last_error: null,
            },
            {
              onConflict: "order_id",
            },
          )
          .select("id");
        if (preErr || !preUp || preUp.length === 0) {
          console.error("[mp-payment-intent] order_payment pre-upsert failed (card)", {
            orderId,
            error: preErr?.message,
            rows: preUp?.length ?? 0,
          });
          return json(
            {
              error: "order_payment_persist_failed",
            },
            {
              status: 500,
            },
          );
        }
        // 2) notification_url — mesma do PIX, compatível com webhook existente.
        const notificationUrl = "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1/mp-webhook";
        // 3) back_urls — auto_return exige HTTPS válido em success.
        const successUrl = String(payload?.success_url ?? "").trim();
        const cancelUrl = String(payload?.cancel_url ?? "").trim();
        if (!/^https:\/\/[^\s]+$/.test(successUrl) || !/^https:\/\/[^\s]+$/.test(cancelUrl)) {
          console.error("[mp-payment-intent] back_urls inválidas (card)", {
            orderId,
            successUrl,
            cancelUrl,
          });
          await sb
            .from("order_payment")
            .update({
              status: "PENDING",
              last_error: "back_urls_invalid",
            })
            .eq("order_id", orderId);
          return json(
            {
              error: "back_urls_invalid",
            },
            {
              status: 400,
            },
          );
        }
        // --- Payer enriquecido (somente campos disponíveis; nada de objeto vazio) ---
        const payloadEmail = String(payload?.payer_email ?? "")
          .trim()
          .toLowerCase();
        // Busca dados do cliente (email real + endereço padrão) quando disponível.
        let custEmail = null;
        let custPhone = order.customer_phone ?? null;
        let custAddress = null;
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
            .order("is_default", {
              ascending: false,
            })
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
        // Prioridade do e-mail: cadastrado > informado no checkout > sintético.
        const finalEmail =
          custEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(custEmail)
            ? custEmail
            : payloadEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payloadEmail)
              ? payloadEmail
              : null;
        // Split nome/sobrenome.
        const fullName = String(order.customer_name ?? "")
          .trim()
          .replace(/\s+/g, " ");
        const parts = fullName ? fullName.split(" ") : [];
        const firstName = parts[0] ?? "";
        const lastName = parts.slice(1).join(" ");
        // CPF só se veio no payload (não temos coluna própria).
        const rawCpf = String(payload?.payer_cpf ?? "").replace(/\D/g, "");
        const cpf = rawCpf.length === 11 ? rawCpf : "";
        // Telefone: preferir do payload; fallback para o telefone do cliente.
        const rawPhone = String(payload?.payer_phone ?? custPhone ?? "").replace(/\D/g, "");
        let phoneObj;
        if (rawPhone.length >= 10) {
          // formato BR: primeiros 2 dígitos = DDD (ignora prefixo 55 se presente)
          const local =
            rawPhone.startsWith("55") && rawPhone.length > 11 ? rawPhone.slice(2) : rawPhone;
          if (local.length >= 10) {
            phoneObj = {
              area_code: local.slice(0, 2),
              number: local.slice(2),
            };
          }
        }
        // Endereço estruturado (payload > custAddress).
        const payloadAddr = payload?.payer_address ?? null;
        const addrSrc = payloadAddr && typeof payloadAddr === "object" ? payloadAddr : custAddress;
        let addressObj;
        if (addrSrc) {
          const zip = String(addrSrc.zip_code ?? addrSrc.cep ?? "").replace(/\D/g, "");
          const street = String(addrSrc.street_name ?? addrSrc.street ?? "").trim();
          const number = String(addrSrc.street_number ?? addrSrc.number ?? "").trim();
          const city = String(addrSrc.city ?? "").trim();
          const state = String(addrSrc.state ?? "").trim();
          const partial = {};
          if (zip) partial.zip_code = zip;
          if (street) partial.street_name = street;
          if (number) partial.street_number = number;
          if (city) partial.city = city;
          if (state) partial.state = state;
          if (Object.keys(partial).length > 0) addressObj = partial;
        }
        const payer = {};
        if (finalEmail) payer.email = finalEmail;
        if (firstName) payer.name = firstName;
        if (lastName) payer.surname = lastName;
        if (cpf)
          payer.identification = {
            type: "CPF",
            number: cpf,
          };
        if (phoneObj) payer.phone = phoneObj;
        if (addressObj) payer.address = addressObj;
        console.log("[mp-payment-intent] creating card preference", {
          order_id: orderId,
          external_reference: order.id,
          notification_url: notificationUrl,
          items_count: cardFinancials.items.length,
          amount: cardFinancials.customerTotal,
          marketplace_fee: cardFinancials.platformFee,
          service_fee_payer: cardFinancials.serviceFeePayer,
          payer_fields: Object.keys(payer),
        });
        // 5) Cria a Preference no Checkout Pro.
        let pref;
        try {
          pref = await createCardPreference(token, {
            orderNumber: order.order_number ?? order.id,
            externalReference: order.id,
            customerTotal: cardFinancials.customerTotal,
            platformFee: cardFinancials.platformFee,
            items: cardFinancials.items,
            payer: Object.keys(payer).length > 0 ? payer : null,
            notificationUrl,
            successUrl,
            failureUrl: cancelUrl,
            pendingUrl: cancelUrl,
          });
        } catch (e) {
          const msg = String(e.message ?? e);
          console.error("[mp-payment-intent] preference create failed", {
            orderId,
            error: msg,
          });
          await sb
            .from("order_payment")
            .update({
              status: "PENDING",
              last_error: msg,
            })
            .eq("order_id", orderId);
          return json(
            {
              error: msg,
            },
            {
              status: 502,
            },
          );
        }
        // 6) init_point (produção) ou sandbox_init_point (sandbox).
        const paymentUrl = pref?.init_point ?? pref?.sandbox_init_point ?? null;
        if (!paymentUrl) {
          console.error("[mp-payment-intent] preference sem init_point", {
            orderId,
            pref_id: pref?.id,
          });
          await sb
            .from("order_payment")
            .update({
              status: "PENDING",
              last_error: "preference_missing_init_point",
            })
            .eq("order_id", orderId);
          return json(
            {
              error: "preference_missing_init_point",
            },
            {
              status: 502,
            },
          );
        }
        // 7) Persiste preference_id e URL (compatível com webhook: lookup por external_reference).
        const { error: postErr } = await sb
          .from("order_payment")
          .upsert(
            {
              order_id: orderId,
              restaurant_id: order.restaurant_id,
              provider: "mercado_pago",
              payment_method: "credit_card",
              payment_id: String(pref.id),
              external_reference: order.id,
              status: "PENDING",
              transaction_amount: cardFinancials.customerTotal,
              payment_url: paymentUrl,
              last_error: null,
            },
            {
              onConflict: "order_id",
            },
          )
          .select("id");
        if (postErr) {
          console.error("[mp-payment-intent] order_payment post-upsert failed (card)", {
            orderId,
            error: postErr.message,
          });
          return json(
            {
              error: "order_payment_persist_failed",
            },
            {
              status: 500,
            },
          );
        }
        return json({
          pending: false,
          payment_id: String(pref.id),
          status: "PENDING",
          payment_url: paymentUrl,
        });
      }
      // PIX — requer payer_email real; sem fallback fictício.
      const payerEmail = String(payload?.payer_email ?? "")
        .trim()
        .toLowerCase();
      if (!payerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payerEmail)) {
        return json(
          {
            error: "payer_email_required",
          },
          {
            status: 400,
          },
        );
      }
      const { data: pricingSnapshot, error: pricingErr } = await sb
        .from("order_pricing_snapshot")
        .select("platform_fee")
        .eq("order_id", orderId)
        .maybeSingle();
      if (pricingErr) throw pricingErr;
      const rawPlatformFee = pricingSnapshot?.platform_fee;
      const platformFee = Number(rawPlatformFee);
      if (
        rawPlatformFee === null ||
        rawPlatformFee === undefined ||
        rawPlatformFee === "" ||
        !Number.isFinite(platformFee) ||
        platformFee < 0
      ) {
        return json(
          {
            error: "invalid_platform_fee",
          },
          {
            status: 500,
          },
        );
      }
      // Garante linha em order_payment ANTES de chamar o MP.
      const { data: preUp, error: preErr } = await sb
        .from("order_payment")
        .upsert(
          {
            order_id: orderId,
            restaurant_id: order.restaurant_id,
            provider: "mercado_pago",
            payment_method: "pix",
            status: "PENDING",
            transaction_amount: order.total,
            external_reference: order.id,
            last_error: null,
          },
          {
            onConflict: "order_id",
          },
        )
        .select("id");
      if (preErr || !preUp || preUp.length === 0) {
        console.error("[mp-payment-intent] order_payment pre-upsert failed", {
          orderId,
          error: preErr?.message,
          rows: preUp?.length ?? 0,
        });
        return json(
          {
            error: "order_payment_persist_failed",
          },
          {
            status: 500,
          },
        );
      }
      const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const callbackUrl = String(payload?.success_url ?? "").trim();
      // notification_url — obrigatório para receber webhook do MP.
      const notificationUrl = "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1/mp-webhook";
      console.log("[mp-payment-intent] creating pix", {
        restaurant_id: order.restaurant_id,
        order_id: orderId,
        external_reference: order.id,
        notification_url: notificationUrl,
        callback_url: /^https:\/\/[^\s]+$/.test(callbackUrl) ? callbackUrl : null,
        payment_method: "pix",
        transaction_amount: Number(order.total),
        application_fee: Number(platformFee.toFixed(2)),
      });
      let mp;
      try {
        mp = await createPixPayment(token, {
          amount: Number(order.total),
          description: `Pedido #${order.order_number ?? order.id}`,
          externalReference: order.id,
          payerEmail,
          expirationDate: expiration,
          notificationUrl,
          platformFee,
          idempotencyKey: `localix-mp-pix-${orderId}`,
          callbackUrl,
        });
      } catch (e) {
        await sb
          .from("order_payment")
          .update({
            status: "PENDING",
            last_error: String(e.message ?? e),
          })
          .eq("order_id", orderId);
        return json(
          {
            error: String(e.message ?? e),
          },
          {
            status: 502,
          },
        );
      }
      const qr = mp?.point_of_interaction?.transaction_data ?? {};
      const status = mapStatus(mp?.status);
      const ticketUrl =
        mp?.point_of_interaction?.transaction_data?.ticket_url ??
        mp?.transaction_details?.external_resource_url ??
        null;
      // Valida notification_url no response do MP — sem ela não devolvemos ticket_url.
      const returnedNotifUrl = String(mp?.notification_url ?? "").trim();
      if (!returnedNotifUrl || returnedNotifUrl !== notificationUrl) {
        console.error("[mp-payment-intent] notification_url ausente/divergente no response MP", {
          orderId,
          mpId: String(mp?.id ?? ""),
          sent: notificationUrl,
          received: returnedNotifUrl,
        });
        try {
          await cancelPayment(token, String(mp.id));
        } catch (_) {}
        await sb
          .from("order_payment")
          .update({
            status: "CANCELLED",
            last_error: "notification_url_missing_in_response",
          })
          .eq("order_id", orderId);
        return json(
          {
            error: "notification_url_missing_in_response",
          },
          {
            status: 500,
          },
        );
      }
      const { data: postUp, error: postErr } = await sb
        .from("order_payment")
        .upsert(
          {
            order_id: orderId,
            restaurant_id: order.restaurant_id,
            provider: "mercado_pago",
            payment_method: "pix",
            payment_id: String(mp.id),
            payment_intent: String(mp.id),
            external_reference: order.id,
            status,
            transaction_amount: Number(mp?.transaction_amount ?? order.total),
            expiration_date: mp?.date_of_expiration ?? expiration,
            qr_code: qr.qr_code ?? null,
            qr_code_base64: qr.qr_code_base64 ?? null,
            payment_url: ticketUrl,
            last_error: null,
          },
          {
            onConflict: "order_id",
          },
        )
        .select("id");
      if (postErr || !postUp || postUp.length === 0) {
        console.error("[mp-payment-intent] order_payment post-upsert failed", {
          orderId,
          mpId: String(mp.id),
          error: postErr?.message,
          rows: postUp?.length ?? 0,
        });
        return json(
          {
            error: "order_payment_persist_failed",
          },
          {
            status: 500,
          },
        );
      }
      await syncOrderStatusFromPayment(
        orderId,
        status,
        "mp-payment-intent:create",
        mp?.status ?? null,
      );
      // Também popula `payments` (mesmo schema que Stripe) para consistência cross-gateway.
      const { error: payErr } = await sb.from("payments").upsert(
        {
          order_id: orderId,
          restaurant_id: order.restaurant_id,
          provider: "mercado_pago",
          external_id: String(mp.id),
          method: "pix",
          status: status.toLowerCase(),
          amount: Number(mp?.transaction_amount ?? order.total),
          currency: mp?.currency_id ?? "BRL",
          qr_code: qr.qr_code ?? null,
          qr_code_base64: qr.qr_code_base64 ?? null,
          ticket_url: ticketUrl,
          payer_email: payerEmail,
          raw: mp,
        },
        {
          onConflict: "provider,external_id",
        },
      );
      if (payErr)
        console.error("[mp-payment-intent] payments upsert failed", {
          orderId,
          error: payErr.message,
        });
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
      if (!existing?.payment_id)
        return json({
          status: existing?.status ?? "PENDING",
        });
      const mp = await getPayment(token, existing.payment_id);
      const status = mapStatus(mp?.status);
      // Detecta expiração pela data se MP não devolveu status cancelado
      let finalStatus = status;
      if (
        status === "PENDING" &&
        existing.expiration_date &&
        new Date(existing.expiration_date) < new Date()
      ) {
        finalStatus = "EXPIRED";
      }
      await sb
        .from("order_payment")
        .update({
          status: finalStatus,
        })
        .eq("order_id", orderId);
      await syncOrderStatusFromPayment(
        orderId,
        finalStatus,
        "mp-payment-intent:status",
        mp?.status ?? null,
      );
      return json({
        status: finalStatus,
        payment_id: existing.payment_id,
        raw_status: mp?.status,
      });
    }
    // ---------- REFUND ----------
    if (action === "refund") {
      const paymentId = String(existing?.payment_id ?? "").trim();
      const currentPaymentStatus = String(existing?.status ?? "").toUpperCase();
      if (!paymentId) {
        return json(
          {
            error: "payment_id_missing",
          },
          {
            status: 409,
          },
        );
      }
      if (String(existing?.provider ?? "") !== "mercado_pago") {
        return json(
          {
            error: "unsupported_refund_provider",
          },
          {
            status: 409,
          },
        );
      }
      if (currentPaymentStatus === "REFUNDED") {
        return json({
          payment_id: paymentId,
          status: "REFUNDED",
          refunded: true,
          idempotent: true,
        });
      }
      if (currentPaymentStatus !== "APPROVED") {
        return json(
          {
            error: "payment_not_refundable",
            payment_status: currentPaymentStatus || null,
          },
          {
            status: 409,
          },
        );
      }
      const refundIdempotencyKey = await buildRefundIdempotencyKey(orderId, paymentId);
      let refund;
      try {
        refund = await createPaymentRefund(token, paymentId, refundIdempotencyKey);
      } catch (e) {
        const msg = String(e.message ?? e);
        console.error("[mp-payment-intent] refund failed", {
          orderId,
          payment_id: paymentId,
          error: msg,
        });
        await sb
          .from("order_payment")
          .update({
            last_error: msg,
          })
          .eq("order_id", orderId);
        return json(
          {
            error: msg,
          },
          {
            status: 502,
          },
        );
      }
      const refundRaw = sanitizeMpRefundRaw(refund);
      const refundId = refund?.id ? String(refund.id) : null;
      const refundAmount = Number(refund?.amount ?? existing?.transaction_amount ?? 0) || 0;
      const now = new Date().toISOString();
      await sb
        .from("order_payment")
        .update({
          status: "REFUNDED",
          last_error: null,
          updated_at: now,
        })
        .eq("order_id", orderId);
      const { data: paymentRow } = await sb
        .from("payments")
        .select("raw")
        .eq("provider", "mercado_pago")
        .eq("external_id", paymentId)
        .maybeSingle();
      const previousRaw =
        paymentRow?.raw && typeof paymentRow.raw === "object" ? paymentRow.raw : {};
      await sb
        .from("payments")
        .update({
          status: "refunded",
          raw: {
            ...previousRaw,
            last_refund: refundRaw,
            refund_id: refundId,
            refund_idempotency_key: refundIdempotencyKey,
          },
          updated_at: now,
        })
        .eq("provider", "mercado_pago")
        .eq("external_id", paymentId);
      const correlationId = `mp-refund:${refundId ?? paymentId}`;
      const tr = await transitionOrder({
        orderId,
        to: "reembolsado",
        reason: "mp:refund",
        actorType: "system",
        service: "mp-payment-intent:refund",
        correlationId,
        metadata: {
          mp_payment_id: paymentId,
          refund_id: refundId,
          refund_amount: refundAmount,
          idempotency_key: refundIdempotencyKey,
        },
      });
      if (!tr.ok) {
        console.warn("[mp-payment-intent] refund order transition rejected", {
          orderId,
          payment_id: paymentId,
          correlationId,
          reason: tr.reason ?? tr.error,
        });
      }
      return json({
        payment_id: paymentId,
        refund_id: refundId,
        refund_amount: refundAmount,
        status: "REFUNDED",
        order_status: tr.ok ? "reembolsado" : order.status,
        transition_ok: !!tr.ok,
        refunded: true,
      });
    }
    // ---------- CANCEL ----------
    if (action === "cancel") {
      if (!existing?.payment_id) {
        await sb
          .from("order_payment")
          .update({
            status: "CANCELLED",
          })
          .eq("order_id", orderId);
        return json({
          status: "CANCELLED",
        });
      }
      try {
        await cancelPayment(token, existing.payment_id);
      } catch (_) {}
      await sb
        .from("order_payment")
        .update({
          status: "CANCELLED",
        })
        .eq("order_id", orderId);
      return json({
        status: "CANCELLED",
      });
    }
    return json(
      {
        error: "Ação inválida",
      },
      {
        status: 400,
      },
    );
  } catch (e) {
    console.error("[mp-payment-intent]", e);
    return json(
      {
        error: String(e.message ?? e),
      },
      {
        status: 500,
      },
    );
  }
});
