import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    const restaurantId = String(payload?.restaurant_id ?? "").trim();
    if (!restaurantId) return json({ error: "restaurant_id_required" }, { status: 400 });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data, error } = await sb
      .from("mercado_pago_accounts")
      .select("connected, public_key")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.connected || !data.public_key) {
      return json({ public_key: null, connected: false });
    }

    return json({
      public_key: await decryptToken(data.public_key),
      connected: true,
    });
  } catch (error) {
    console.error("[mp-public-key]", error);
    return json({ error: "mp_public_key_unavailable" }, { status: 500 });
  }
});
