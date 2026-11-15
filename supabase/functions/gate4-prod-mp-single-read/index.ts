/**
 * Localix Gate Financeiro — consulta pontual, somente leitura.
 * NÃO IMPLANTAR sem revisão de segurança e autorização específica.
 * Execução restrita ao evento 6ae21bfe-20df-4763-9311-bd05fdb40e1a.
 * Não cria pagamentos, não usa webhook receiver, não altera banco, não registra tokens.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptToken } from "../_shared/crypto.ts";

const PROD_URL = "https://mvkfrwxgneqzvoabkaws.supabase.co";
const EVENT_ID = "6ae21bfe-20df-4763-9311-bd05fdb40e1a";
const PAYMENT_ID = "174057974773";
const SELLER_ID = "3625464467";
const RESTAURANT_ID = "3714616d-7b69-4118-8ac3-57076a70212a";

function respond(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (Deno.env.get("SUPABASE_URL") !== PROD_URL) return respond(403, { error: "wrong_environment" });
  if (req.method !== "GET") return respond(405, { error: "method_not_allowed" });
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("Authorization") ?? "");
  if (!bearer) return respond(401, { error: "unauthorized" });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return respond(503, { error: "service_not_configured" });
  const sb = createClient(PROD_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: auth, error: authErr } = await sb.auth.getUser(bearer[1]);
    if (authErr || !auth.user) return respond(401, { error: "unauthorized" });

    const { data: rest, error: restErr } = await sb.from("restaurants")
      .select("id,owner_id").eq("id", RESTAURANT_ID).maybeSingle();
    if (restErr || !rest || rest.owner_id !== auth.user.id) {
      return respond(403, { error: "owner_required" });
    }

    const { data: event, error: eventErr } = await sb.from("payment_webhook_events")
      .select("id,provider,processed,resource_id,error_message,payload_json")
      .eq("id", EVENT_ID).maybeSingle();
    if (eventErr || !event || event.provider !== "mercado_pago" ||
        event.processed !== false || event.resource_id !== PAYMENT_ID ||
        event.error_message !== "no_access_token" ||
        String(event.payload_json?.user_id ?? "") !== SELLER_ID) {
      return respond(409, { error: "event_state_changed" });
    }

    const { data: oauth, error: oauthErr } = await sb.from("mercado_pago_accounts")
      .select("mp_user_id,restaurant_id,live_mode,connected,access_token")
      .eq("restaurant_id", RESTAURANT_ID).eq("mp_user_id", SELLER_ID).maybeSingle();
    if (oauthErr || !oauth || oauth.connected !== true || oauth.live_mode !== true ||
        oauth.restaurant_id !== RESTAURANT_ID || oauth.mp_user_id !== SELLER_ID) {
      return respond(409, { error: "seller_context_unavailable" });
    }
    // No generic MP_ACCESS_TOKEN fallback. OAuth stored encrypted by the application's own helper.
    if (typeof oauth.access_token !== "string" || !oauth.access_token.startsWith("v1:")) {
      return respond(409, { error: "encrypted_token_required" });
    }
    const token = await decryptToken(oauth.access_token);
    if (!token || !token.startsWith("APP_USR-")) {
      return respond(409, { error: "live_token_required" });
    }

    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(
        "https://api.mercadopago.com/v1/payments/" + PAYMENT_ID,
        { method: "GET", headers: { Authorization: "Bearer " + token }, signal: ctl.signal },
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) return respond(200, {
      lookup: "UNCONFIRMED", gateway_http_status: response.status,
      seller_context: "oauth_live_matched",
    });
    const mp = await response.json();
    if (String(mp?.id ?? "") !== PAYMENT_ID ||
        String(mp?.collector_id ?? "") !== SELLER_ID) {
      return respond(409, { lookup: "IDENTITY_MISMATCH" });
    }
    const externalReference = typeof mp.external_reference === "string"
      ? mp.external_reference.slice(0, 120) : null;
    return respond(200, {
      lookup: "MATCHED_SELLER",
      payment_id: PAYMENT_ID,
      collector_id: SELLER_ID,
      external_reference: externalReference,
      status: typeof mp.status === "string" ? mp.status.slice(0, 40) : null,
      status_detail: typeof mp.status_detail === "string" ? mp.status_detail.slice(0, 80) : null,
      amount: typeof mp.transaction_amount === "number" ? mp.transaction_amount : null,
      currency: typeof mp.currency_id === "string" ? mp.currency_id.slice(0, 5) : null,
      date_created: typeof mp.date_created === "string" ? mp.date_created.slice(0, 40) : null,
    });
  } catch {
    return respond(503, { error: "lookup_failed" });
  }
});
