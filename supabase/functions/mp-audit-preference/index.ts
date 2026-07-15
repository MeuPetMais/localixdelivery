// Diagnóstico temporário: GET /checkout/preferences/:id com token OAuth do restaurante.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const prefId = url.searchParams.get("id");
  if (!prefId) return json({ error: "missing_id" }, { status: 400 });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: op } = await sb
    .from("order_payment")
    .select("restaurant_id, order_id, payment_method")
    .eq("payment_id", prefId)
    .maybeSingle();
  if (!op) return json({ error: "order_payment_not_found" }, { status: 404 });

  const { data: acc } = await sb
    .from("mercado_pago_accounts")
    .select("access_token, mp_user_id, live_mode, connected")
    .eq("restaurant_id", op.restaurant_id)
    .maybeSingle();

  const token = await decryptToken(acc?.access_token ?? null);
  const source = token ? "restaurant_oauth" : "fallback_env";
  const useToken = token ?? Deno.env.get("MP_ACCESS_TOKEN") ?? null;
  if (!useToken) return json({ error: "no_token" }, { status: 500 });

  const res = await fetch(`https://api.mercadopago.com/checkout/preferences/${prefId}`, {
    headers: { Authorization: `Bearer ${useToken}` },
  });
  const body = await res.json().catch(() => ({}));
  return json({
    http_status: res.status,
    token_source: source,
    restaurant_mp_user_id: acc?.mp_user_id ?? null,
    restaurant_live_mode: acc?.live_mode ?? null,
    preference: body,
  });
});
