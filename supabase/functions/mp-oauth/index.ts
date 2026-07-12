// Mercado Pago OAuth — actions: start | status | disconnect
// Todas as operações que envolvem tokens rodam aqui, nunca no frontend.

import { corsHeaders, json } from "../_shared/cors.ts";
import { requireOwner } from "../_shared/mp-auth.ts";
import {
  decryptToken,
  pkceChallengeS256,
  randomBase64Url,
} from "../_shared/crypto.ts";

const REDIRECT_URI = "https://app.rngdigital.com.br/api/public/mp/callback";
const MP_AUTH_BASE = "https://auth.mercadopago.com/authorization";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await safeJson(req) : {};
    const action = (body?.action ?? url.searchParams.get("action") ?? "status") as string;
    const restaurantId = (body?.restaurant_id ?? url.searchParams.get("restaurant_id")) as string;
    if (!restaurantId) return json({ error: "restaurant_id obrigatório" }, { status: 400 });

    const ctx = await requireOwner(req, restaurantId);

    if (action === "start") {
      const appId = Deno.env.get("MP_APP_ID");
      if (!appId) return json({ error: "MP_APP_ID não configurado" }, { status: 500 });

      const state = randomBase64Url(24);
      const codeVerifier = randomBase64Url(48);
      const codeChallenge = await pkceChallengeS256(codeVerifier);

      const { error: stErr } = await ctx.admin.from("oauth_states").insert({
        state,
        provider: "mercado_pago",
        restaurant_id: restaurantId,
        user_id: ctx.userId,
        code_verifier: codeVerifier,
        redirect_to: body?.redirect_to ?? null,
      });
      if (stErr) throw stErr;

      const authUrl = new URL(MP_AUTH_BASE);
      authUrl.searchParams.set("client_id", appId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("platform_id", "mp");
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");

      const _full = authUrl.toString();
      console.log("[mp-oauth][start] MP_APP_ID:", appId);
      console.log("[mp-oauth][start] client_id:", appId);
      console.log("[mp-oauth][start] authorize_url:", _full);
      return json({ authorize_url: _full });
    }

    if (action === "status") {
      const { data } = await ctx.admin
        .from("mercado_pago_accounts")
        .select(
          "connected, mp_user_id, live_mode, scope, connected_at, disconnected_at, expires_at, public_key",
        )
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      return json({
        connected: !!data?.connected,
        mp_user_id: data?.mp_user_id ?? null,
        live_mode: data?.live_mode ?? false,
        scope: data?.scope ?? null,
        connected_at: data?.connected_at ?? null,
        disconnected_at: data?.disconnected_at ?? null,
        expires_at: data?.expires_at ?? null,
        // A chave pública NÃO é secreta (usada no SDK do MP no browser).
        public_key: data?.public_key ? await decryptToken(data.public_key) : null,
      });
    }

    if (action === "disconnect") {
      await ctx.admin
        .from("mercado_pago_accounts")
        .update({
          connected: false,
          access_token: null,
          refresh_token: null,
          disconnected_at: new Date().toISOString(),
        })
        .eq("restaurant_id", restaurantId);
      return json({ ok: true });
    }

    return json({ error: "ação desconhecida" }, { status: 400 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[mp-oauth] error", err);
    return json({ error: (err as Error).message ?? "erro" }, { status: 500 });
  }
});

async function safeJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
