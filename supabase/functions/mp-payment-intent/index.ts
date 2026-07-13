// Mercado Pago — Payment Intent
// Ações: create | status | cancel
// - Nunca expõe access token ao frontend.
// - Cartão: prepara a estrutura (retorna { pending: true }); pagamento será
//   implementado depois.
// - Pix: cria pagamento e retorna QR Code + copia-e-cola + expiração.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";

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
}) {
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: Number(params.amount.toFixed(2)),
      description: params.description,
      payment_method_id: "pix",
      external_reference: params.externalReference,
      date_of_expiration: params.expirationDate,
      notification_url: params.notificationUrl,
      payer: { email: params.payerEmail },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || `MP error ${res.status}`;
    throw new Error(msg);
  }
  return body;
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
      .select("id, restaurant_id, order_number, total, customer_name, customer_phone")
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
      // Cartão: estrutura pronta, integração fica para próximo prompt
      if (method !== "pix") {
        const { data: upd, error: upErr } = await sb.from("order_payment").upsert({
          order_id: orderId,
          restaurant_id: order.restaurant_id,
          provider: "mercado_pago",
          payment_method: method,
          status: "PENDING",
          transaction_amount: order.total,
          last_error: null,
        }, { onConflict: "order_id" }).select("id");
        if (upErr || !upd || upd.length === 0) {
          console.error("[mp-payment-intent] order_payment upsert failed (card)", { orderId, error: upErr?.message, rows: upd?.length ?? 0 });
          return json({ error: "order_payment_persist_failed" }, { status: 500 });
        }
        return json({
          pending: true,
          message: "Cartão será implementado em etapa futura",
          payment_id: null,
          status: "PENDING",
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
      let mp;
      try {
        mp = await createPixPayment(token, {
          amount: Number(order.total),
          description: `Pedido #${order.order_number ?? order.id}`,
          externalReference: order.id,
          payerEmail,
          expirationDate: expiration,
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
