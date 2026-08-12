// Callback pÃºblico do Mercado Pago (chamado pelo prÃ³prio MP apÃ³s autorizar).
// Recebe ?code&state, troca por access_token usando o Client Secret do
// aplicativo Mercado Pago, cifra e persiste tokens.
// verify_jwt = false (configurado em supabase/config.toml).

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/mp-auth.ts";
import { encryptToken } from "../_shared/crypto.ts";
import {
  getRequiredMpEnvironmentConfig,
  getRequiredMpOAuthConfig,
  resolveMercadoPagoOAuthAccountEnvironment,
} from "../_shared/mp-security.ts";

const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const params = req.method === "POST" ? await req.json() : Object.fromEntries(url.searchParams);
    const code = params.code as string | undefined;
    const state = params.state as string | undefined;
    if (!code || !state) return jsonErr("code e state obrigatÃ³rios", 400);

    const admin = adminClient();

    const { data: st } = await admin
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .eq("provider", "mercado_pago")
      .maybeSingle();
    if (!st) return jsonErr("state invÃ¡lido", 400);
    if (st.used_at) return jsonErr("state jÃ¡ utilizado", 400);
    if (new Date(st.expires_at).getTime() < Date.now()) return jsonErr("state expirado", 400);

    const environmentConfig = getRequiredMpEnvironmentConfig(Deno.env);
    if (!environmentConfig.ok) {
      console.error("[mp-oauth-callback]", {
        provider: "mercado_pago",
        restaurant_id: st.restaurant_id,
        error: environmentConfig.error,
        reason: environmentConfig.reason,
        timestamp: new Date().toISOString(),
      });
      return jsonErr(environmentConfig.error, 500);
    }

    const oauthConfig = getRequiredMpOAuthConfig(Deno.env);
    if (!oauthConfig.ok) {
      console.error("[mp-oauth-callback]", {
        provider: "mercado_pago",
        restaurant_id: st.restaurant_id,
        error: oauthConfig.error,
        timestamp: new Date().toISOString(),
      });
      return jsonErr(oauthConfig.error, 500);
    }


    // Troca do authorization_code por access_token do lojista.
    const tokenRes = await fetch(MP_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: oauthConfig.appId,
        client_secret: oauthConfig.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: environmentConfig.oauthRedirectUri,
        code_verifier: st.code_verifier,
      }),
    });

    const rawBody = await tokenRes.text();
    let tokenJson: any = {};
    try { tokenJson = JSON.parse(rawBody); } catch { tokenJson = { error: "non_json_response" }; }

    console.info("[mp-oauth-callback] token exchange response", {
      provider: "mercado_pago",
      restaurant_id: st.restaurant_id,
      http_status: tokenRes.status,
      ok: tokenRes.ok,
      timestamp: new Date().toISOString(),
    });

    if (!tokenRes.ok) {
      const sanitizedError = sanitizeOAuthError(tokenJson);
      console.error("[mp-oauth-callback] token exchange failed", {
        provider: "mercado_pago",
        restaurant_id: st.restaurant_id,
        http_status: tokenRes.status,
        error: sanitizedError,
        timestamp: new Date().toISOString(),
      });

      await admin.from("payment_logs").insert({
        restaurant_id: st.restaurant_id,
        level: "error",
        message: "MP OAuth token exchange failed",
        data: {
          http_status: tokenRes.status,
          error: sanitizedError,
          redirect_uri: environmentConfig.oauthRedirectUri,
          code_verifier_found: !!st.code_verifier,
        },
      });

      return new Response(JSON.stringify({ error: "mercadopago_oauth_token_exchange_failed" }), {
        status: tokenRes.status,
        headers: {
          "content-type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const expiresAt = tokenJson.expires_in
      ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
      : null;

    const accountValidation = resolveMercadoPagoOAuthAccountEnvironment(tokenJson, Deno.env, environmentConfig);
    if (!accountValidation.ok) {
      console.error("[mp-oauth-callback] MP account not allowed in staging", {
        provider: "mercado_pago",
        restaurant_id: st.restaurant_id,
        error: accountValidation.error,
        timestamp: new Date().toISOString(),
      });
      return jsonErr(accountValidation.error, 400);
    }

    await admin.from("mercado_pago_accounts").upsert(
      {
        restaurant_id: st.restaurant_id,
        mp_user_id: accountValidation.mpUserId,
        access_token: await encryptToken(tokenJson.access_token ?? ""),
        refresh_token: await encryptToken(tokenJson.refresh_token ?? ""),
        public_key: await encryptToken(tokenJson.public_key ?? ""),
        scope: tokenJson.scope ?? null,
        live_mode: accountValidation.liveMode,
        connected: true,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        raw: sanitize(tokenJson),
      },
      { onConflict: "restaurant_id" },
    );

    await admin.from("oauth_states").update({ used_at: new Date().toISOString() }).eq("state", state);

    return redirect(st.redirect_to ?? "/pagamentos?mp=success", environmentConfig.appBaseUrl);
  } catch (err) {
    console.error("[mp-oauth-callback] error", err);
    const environmentConfig = getRequiredMpEnvironmentConfig(Deno.env);
    if (!environmentConfig.ok) return jsonErr("mercadopago_environment_not_configured", 500);
    return redirect("/pagamentos?mp=error&reason=internal", environmentConfig.appBaseUrl);
  }
});

function redirect(path: string, appBaseUrl: string) {
  const base = appBaseUrl;
  const to = path.startsWith("http") ? path : base + path;
  return new Response(null, { status: 302, headers: { location: to, ...corsHeaders } });
}

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function sanitizeOAuthError(obj: Record<string, unknown>) {
  const clone = sanitize(obj);
  delete (clone as any).client_secret;
  delete (clone as any).code;
  delete (clone as any).authorization_code;
  return clone;
}

function sanitize(obj: Record<string, unknown>) {
  const clone = { ...obj };
  delete (clone as any).access_token;
  delete (clone as any).refresh_token;
  delete (clone as any).raw;
  return clone;
}
