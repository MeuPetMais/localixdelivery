// Callback público do Mercado Pago (chamado pelo próprio MP após autorizar).
// Recebe ?code&state, troca por access_token usando o Client Secret do
// aplicativo Mercado Pago, cifra e persiste tokens.
// verify_jwt = false (configurado em supabase/config.toml).

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/mp-auth.ts";
import { encryptToken } from "../_shared/crypto.ts";
import { resolveMpOAuthRedirectUri, resolveMpOAuthAppRedirect } from "../_shared/mp-oauth-url.ts";

const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const params = req.method === "POST" ? await req.json() : Object.fromEntries(url.searchParams);
    const code = params.code as string | undefined;
    const state = params.state as string | undefined;
    if (!code || !state) return jsonErr("code e state obrigatórios", 400);

    const admin = adminClient();

    const { data: st } = await admin
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .eq("provider", "mercado_pago")
      .maybeSingle();
    if (!st) return jsonErr("state inválido", 400);
    if (st.used_at) return jsonErr("state já utilizado", 400);
    if (new Date(st.expires_at).getTime() < Date.now()) return jsonErr("state expirado", 400);

    const redirectUri = resolveMpOAuthRedirectUri(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("MP_OAUTH_REDIRECT_URI"),
    );
    // Validate navigation before consuming single-use authorization code.
    resolveMpOAuthAppRedirect(Deno.env.get("APP_URL"), st.redirect_to, true);
    const appId = Deno.env.get("MP_APP_ID");
    const mpClientSecret = Deno.env.get("MP_CLIENT_SECRET");
    if (!appId || !mpClientSecret)
      return jsonErr("MP_APP_ID/MP_CLIENT_SECRET não configurados", 500);

    // Troca do authorization_code por access_token do lojista.
    const tokenRes = await fetch(MP_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: mpClientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: st.code_verifier,
      }),
    });

    const rawBody = await tokenRes.text();
    let tokenJson: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      public_key?: string;
      user_id?: string | number;
      live_mode?: boolean;
      scope?: string;
      raw?: string;
      [key: string]: unknown;
    } = {};
    try {
      tokenJson = JSON.parse(rawBody);
    } catch {
      tokenJson = { raw: rawBody };
    }

    if (!tokenRes.ok) {
      console.error("[mp-oauth-callback] token exchange failed", { status: tokenRes.status });

      await admin.from("payment_logs").insert({
        restaurant_id: st.restaurant_id,
        level: "error",
        message: "MP OAuth token exchange failed",
        data: {
          http_status: tokenRes.status,
          status: tokenRes.status,
          redirect_host: new URL(redirectUri).hostname,
        },
      });

      return jsonErr("oauth_token_exchange_failed", 502);
    }

    const expiresAt = tokenJson.expires_in
      ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
      : null;

    if (!tokenJson.access_token || !tokenJson.user_id) {
      return jsonErr("oauth_incomplete_token_response", 502);
    }
    if (Deno.env.get("MP_ENVIRONMENT") === "test" && tokenJson.live_mode === true) {
      return jsonErr("oauth_live_token_rejected_in_test", 403);
    }

    const { error: accountError } = await admin.from("mercado_pago_accounts").upsert(
      {
        restaurant_id: st.restaurant_id,
        mp_user_id: String(tokenJson.user_id ?? ""),
        access_token: await encryptToken(tokenJson.access_token ?? ""),
        refresh_token: await encryptToken(tokenJson.refresh_token ?? ""),
        public_key: await encryptToken(tokenJson.public_key ?? ""),
        scope: tokenJson.scope ?? null,
        live_mode: tokenJson.live_mode ?? true,
        connected: true,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        raw: sanitize(tokenJson),
      },
      { onConflict: "restaurant_id" },
    );

    if (accountError) throw new Error("oauth_account_persistence_failed");

    const { error: stateError } = await admin
      .from("oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("state", state);
    if (stateError) throw new Error("oauth_state_persistence_failed");

    return redirect(st.redirect_to ?? "/pagamentos?mp=success", true);
  } catch (err) {
    console.error("[mp-oauth-callback] error", err);
    return redirect("/pagamentos?mp=error&reason=internal", false);
  }
});

function redirect(path: string, success: boolean) {
  try {
    const location = resolveMpOAuthAppRedirect(Deno.env.get("APP_URL"), path, success);
    return new Response(null, { status: 302, headers: { location, ...corsHeaders } });
  } catch {
    return jsonErr("oauth_app_redirect_not_configured_or_unsafe", 500);
  }
}

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function sanitize(obj: Record<string, unknown>) {
  const clone = { ...obj };
  delete clone.access_token;
  delete clone.refresh_token;
  return clone;
}
