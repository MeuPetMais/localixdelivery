// Diagnóstico temporário: consulta GET /v1/payments/:id com o access token OAuth
// do restaurante e devolve apenas campos de auditoria (não expõe tokens).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { getRestaurantMpAccessToken } from "../_shared/mp-security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("id");
  if (!paymentId) return json({ error: "missing_id" }, { status: 400 });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: op } = await sb
    .from("order_payment")
    .select("restaurant_id, order_id")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (!op) return json({ error: "order_payment_not_found" }, { status: 404 });

  const { data: acc } = await sb
    .from("mercado_pago_accounts")
    .select("mp_user_id, live_mode, connected")
    .eq("restaurant_id", op.restaurant_id)
    .maybeSingle();

  const tokenResult = await getRestaurantMpAccessToken(sb as any, op.restaurant_id, decryptToken);
  if (!tokenResult.ok) return json({ error: tokenResult.error }, { status: 409 });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${tokenResult.token}` },
  });
  const body = await res.json();

  return json({
    http_status: res.status,
    token_source: "restaurant_oauth",
    restaurant_mp_user_id: acc?.mp_user_id ?? null,
    restaurant_live_mode: acc?.live_mode ?? null,
    payment: {
      id: body?.id ?? null,
      status: body?.status ?? null,
      collector_id: body?.collector_id ?? null,
      application_id: body?.application_id ?? null,
      live_mode: body?.live_mode ?? null,
      notification_url: body?.notification_url ?? null,
      sponsor_id: body?.sponsor_id ?? null,
      external_reference: body?.external_reference ?? null,
      date_created: body?.date_created ?? null,
    },
    error: body?.error ?? null,
    message: body?.message ?? null,
  });
});
