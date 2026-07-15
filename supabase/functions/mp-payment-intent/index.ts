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

type MpStatus = "pending" | "in_process" | "approved" | "rejected" | "cancelled" | "refunded" | "charged_back";
type LocalStatus = "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";

function mapStatus(s: string | null | undefined): LocalStatus {
  switch ((s ?? "").toLowerCase() as MpStatus) {
    case "approved": return "APPROVED";
    case "in_process": return "PROCESSING";
    case "rejected": return "REJECTED";
    case "cancelled": return "CANCELLED";
    case "refunded":
    case "charged_back": return "APPROVED";
    default: return "PENDING";
  }
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getAccessToken(sb: ReturnType<typeof admin>, restaurantId: string): Promise<string> {
  const { data } = await sb
    .from("mercado_pago_accounts")
    .select("access_token, connected")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!data?.connected || !data.access_token) {
    // Fallback à conta da plataforma (útil enquanto o restaurante não conectou)
    const platform = Deno.env.get("MP_ACCESS_TOKEN");
    if (!platform) throw new Error("Restaurante sem Mercado Pago conectado");
    return platform;
  }
  const token = await decryptToken(data.access_token);
  if (!token) throw new Error("Token inválido");
  return token;
}

async function createPixPayment(token: string, params: {
  amount: number;
  description: string;
  externalReference: string;
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

  // O retorno automático do Mercado Pago para PIX usa callback_url.
  // Mantemos opcional para não quebrar ambiente local sem HTTPS.
  if (params.callbackUrl && /^https:\/\/[^\s]+$/.test(params.callbackUrl)) {
    body.callback_url = params.callbackUrl;
  }

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
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
  orderNumber: string | number;
  externalReference: string;
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

async function syncOrderStatusFromPayment(orderId: string, status: LocalStatus, source: string, rawStatus?: string | null) {
  const target: Record<LocalStatus, string | null> = {
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
    if (!orderId) return json({ error: "order_id obrigatório" }, { status: 400 });

    const sb = admin();

    // Carrega pedido + pagamento
    const { data: order, error: ordErr } = await sb
      .from("orders")
      .select("id, restaurant_id, order_number, total, customer_name, customer_phone, items")
      .eq("id", orderId)
      .maybeSingle();
    if (ordErr) throw ordErr;
    if (!order) return json({ error: "Pedido não encontrado" }, { status: 404 });

    const { data: existing } = await sb
      .from("order_payment")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    const method = String(payload?.payment_method ?? existing?.payment_method ?? "pix").toLowerCase();
    const token = await getAccessToken(sb, order.restaurant_id);

    // ---------- CREATE ----------
    if (action === "create") {
      // Cartão Online — Mercado Pago Checkout Pro (Preference + redirect).
      if (method !== "pix") {
        // 1) Garante linha em order_payment ANTES de chamar o MP.
        const { data: preUp, error: preErr } = await sb.from("order_payment").upsert({
          order_id: orderId,
          restaurant_id: order.restaurant_id,
          provider: "mercado_pago",
          payment_method: "credit_card",
          status: "PENDING",
          transaction_amount: order.total,
          external_reference: order.id,
          last_error: null,
        }, { onConflict: "order_id" }).select("id");
        if (preErr || !preUp || preUp.length === 0) {
          console.error("[mp-payment-intent] order_payment pre-upsert failed (card)", { orderId, error: preErr?.message, rows: preUp?.length ?? 0 });
          return json({ error: "order_payment_persist_failed" }, { status: 500 });
        }

        // 2) notification_url — mesma do PIX, compatível com webhook existente.
        const notificationUrl = (Deno.env.get("MP_NOTIFICATION_URL") ?? "https://app.rngdigital.com.br/api/public/mp/webhook").trim();
        if (!/^https:\/\/[^\s]+\/api\/public\/mp\/webhook$/.test(notificationUrl)) {
          console.error("[mp-payment-intent] notification_url inválida (card)", { orderId, notificationUrl });
          await sb.from("order_payment").update({ status: "PENDING", last_error: "notification_url_invalid" }).eq("order_id", orderId);
          return json({ error: "notification_url_invalid" }, { status: 500 });
        }

        // 3) back_urls — auto_return exige HTTPS válido em success.
        const successUrl = String(payload?.success_url ?? "").trim();
        const cancelUrl = String(payload?.cancel_url ?? "").trim();
        if (!/^https:\/\/[^\s]+$/.test(successUrl) || !/^https:\/\/[^\s]+$/.test(cancelUrl)) {
          console.error("[mp-payment-intent] back_urls inválidas (card)", { orderId, successUrl, cancelUrl });
          await sb.from("order_payment").update({ status: "PENDING", last_error: "back_urls_invalid" }).eq("order_id", orderId);
          return json({ error: "back_urls_invalid" }, { status: 400 });
        }

        // 4) Itens reais do pedido.
        const rawItems = Array.isArray((order as any).items) ? (order as any).items as any[] : [];
        const items = rawItems
          .map((it) => ({
            title: String(it?.name ?? it?.title ?? "Item").slice(0, 250),
            quantity: Math.max(1, Number(it?.qty ?? it?.quantity ?? 1)),
            currency_id: "BRL",
            unit_price: Number(Number(it?.price ?? it?.unit_price ?? 0).toFixed(2)),
          }))
          .filter((it) => it.unit_price > 0 && Number.isFinite(it.unit_price));

        const payerEmail = String(payload?.payer_email ?? "").trim().toLowerCase();

        console.log("[mp-payment-intent] creating card preference", {
          order_id: orderId,
          external_reference: order.id,
          notification_url: notificationUrl,
          items_count: items.length,
          amount: Number(order.total),
        });

        // 5) Cria a Preference no Checkout Pro.
        let pref;
        try {
          pref = await createCardPreference(token, {
            amount: Number(order.total),
            orderNumber: order.order_number ?? order.id,
            externalReference: order.id,
            items,
            payerEmail: payerEmail || null,
            payerName: order.customer_name ?? null,
            notificationUrl,
            successUrl,
            failureUrl: cancelUrl,
            pendingUrl: cancelUrl,
          });
        } catch (e) {
          const msg = String((e as Error).message ?? e);
          console.error("[mp-payment-intent] preference create failed", { orderId, error: msg });
          await sb.from("order_payment").update({ status: "PENDING", last_error: msg }).eq("order_id", orderId);
          return json({ error: msg }, { status: 502 });
        }

        // 6) init_point (produção) ou sandbox_init_point (sandbox).
        const paymentUrl: string | null = pref?.init_point ?? pref?.sandbox_init_point ?? null;
        if (!paymentUrl) {
          console.error("[mp-payment-intent] preference sem init_point", { orderId, pref_id: pref?.id });
          await sb.from("order_payment").update({ status: "PENDING", last_error: "preference_missing_init_point" }).eq("order_id", orderId);
          return json({ error: "preference_missing_init_point" }, { status: 502 });
        }

        // 7) Persiste preference_id e URL (compatível com webhook: lookup por external_reference).
        const { error: postErr } = await sb.from("order_payment").upsert({
          order_id: orderId,
          restaurant_id: order.restaurant_id,
          provider: "mercado_pago",
          payment_method: "credit_card",
          payment_id: String(pref.id),
          external_reference: order.id,
          status: "PENDING",
          transaction_amount: Number(order.total),
          payment_url: paymentUrl,
          last_error: null,
        }, { onConflict: "order_id" }).select("id");
        if (postErr) {
          console.error("[mp-payment-intent] order_payment post-upsert failed (card)", { orderId, error: postErr.message });
          return json({ error: "order_payment_persist_failed" }, { status: 500 });
        }

        return json({
          pending: false,
          payment_id: String(pref.id),
          status: "PENDING",
          payment_url: paymentUrl,
        });
      }



      // PIX — requer payer_email real; sem fallback fictício.
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
        transaction_amount: order.total,
        external_reference: order.id,
        last_error: null,
      }, { onConflict: "order_id" }).select("id");
      if (preErr || !preUp || preUp.length === 0) {
        console.error("[mp-payment-intent] order_payment pre-upsert failed", { orderId, error: preErr?.message, rows: preUp?.length ?? 0 });
        return json({ error: "order_payment_persist_failed" }, { status: 500 });
      }

      const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const callbackUrl = String(payload?.success_url ?? "").trim();

      // notification_url — obrigatório para receber webhook do MP.
      const notificationUrl = (Deno.env.get("MP_NOTIFICATION_URL") ?? "https://app.rngdigital.com.br/api/public/mp/webhook").trim();
      if (!/^https:\/\/[^\s]+\/api\/public\/mp\/webhook$/.test(notificationUrl)) {
        console.error("[mp-payment-intent] notification_url inválida", { orderId, notificationUrl });
        await sb.from("order_payment").update({
          status: "PENDING",
          last_error: "notification_url_invalid",
        }).eq("order_id", orderId);
        return json({ error: "notification_url_invalid" }, { status: 500 });
      }

      console.log("[mp-payment-intent] creating pix", {
        restaurant_id: order.restaurant_id,
        order_id: orderId,
        external_reference: order.id,
        notification_url: notificationUrl,
          callback_url: /^https:\/\/[^\s]+$/.test(callbackUrl) ? callbackUrl : null,
        payment_method: "pix",
        transaction_amount: Number(order.total),
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
          callbackUrl,
        });
      } catch (e) {
        await sb.from("order_payment").update({
          status: "PENDING",
          last_error: String((e as Error).message ?? e),
        }).eq("order_id", orderId);
        return json({ error: String((e as Error).message ?? e) }, { status: 502 });
      }


      const qr = mp?.point_of_interaction?.transaction_data ?? {};
      const status = mapStatus(mp?.status);
      const ticketUrl = mp?.point_of_interaction?.transaction_data?.ticket_url
        ?? mp?.transaction_details?.external_resource_url
        ?? null;

      // Valida notification_url no response do MP — sem ela não devolvemos ticket_url.
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
        transaction_amount: Number(mp?.transaction_amount ?? order.total),
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

      // Também popula `payments` (mesmo schema que Stripe) para consistência cross-gateway.
      const { error: payErr } = await sb.from("payments").upsert({
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

      // Detecta expiração pela data se MP não devolveu status cancelado
      let finalStatus: LocalStatus = status;
      if (status === "PENDING" && existing.expiration_date && new Date(existing.expiration_date) < new Date()) {
        finalStatus = "EXPIRED";
      }

      await sb.from("order_payment").update({ status: finalStatus }).eq("order_id", orderId);
      await syncOrderStatusFromPayment(orderId, finalStatus, "mp-payment-intent:status", mp?.status ?? null);
      return json({ status: finalStatus, payment_id: existing.payment_id, raw_status: mp?.status });
    }

    // ---------- CANCEL ----------
    if (action === "cancel") {
      if (!existing?.payment_id) {
        await sb.from("order_payment").update({ status: "CANCELLED" }).eq("order_id", orderId);
        return json({ status: "CANCELLED" });
      }
      try {
        await cancelPayment(token, existing.payment_id);
      } catch (_) { /* pode já estar finalizado */ }
      await sb.from("order_payment").update({ status: "CANCELLED" }).eq("order_id", orderId);
      return json({ status: "CANCELLED" });
    }

    return json({ error: "Ação inválida" }, { status: 400 });
  } catch (e) {
    console.error("[mp-payment-intent]", e);
    return json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
