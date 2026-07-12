// Callback público do Mercado Pago (chamado pelo próprio MP após autorizar).
// Recebe ?code&state, troca por access_token usando o Client Secret do
// aplicativo Mercado Pago, cifra e persiste tokens.
// verify_jwt = false (configurado em supabase/config.toml).

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/mp-auth.ts";
import { encryptToken } from "../_shared/crypto.ts";

const REDIRECT_URI = "https://app.rngdigital.com.br/api/public/mp/callback";
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

    const appId = Deno.env.get("MP_APP_ID");
    const mpClientSecret = Deno.env.get("MP_CLIENT_SECRET") || Deno.env.get("MP_ACCESS_TOKEN");
    if (!appId || !mpClientSecret) return jsonErr("MP_APP_ID/MP_CLIENT_SECRET não configurados", 500);

    console.log("[mp-oauth-callback][pre-exchange]", {
      state_found: !!st,
      code_verifier_found: !!st?.code_verifier,
      code_present: !!code,
      code_length: code?.length ?? 0,
      redirect_uri: REDIRECT_URI,
      client_id: appId,
      client_secret_present: !!mpClientSecret,
      client_secret_source: Deno.env.get("MP_CLIENT_SECRET") ? "MP_CLIENT_SECRET" : "MP_ACCESS_TOKEN_FALLBACK",
    });

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
        redirect_uri: REDIRECT_URI,
        code_verifier: st.code_verifier,
      }),
    });

    const rawBody = await tokenRes.text();
    let tokenJson: any = {};
    try { tokenJson = JSON.parse(rawBody); } catch { tokenJson = { raw: rawBody }; }

    console.log("[mp-oauth-callback][mp-response]", {
      http_status: tokenRes.status,
      ok: tokenRes.ok,
      body: rawBody,
    });

    if (!tokenRes.ok) {
      console.error("[mp-oauth-callback] MP error", {
        status: tokenRes.status,
        body: rawBody,
        redirect_uri: REDIRECT_URI,
        client_id: appId,
        client_secret_present: !!mpClientSecret,
        client_secret_source: Deno.env.get("MP_CLIENT_SECRET") ? "MP_CLIENT_SECRET" : "MP_ACCESS_TOKEN_FALLBACK",
        code_verifier_found: !!st?.code_verifier,
        state_found: !!st,
        code_present: !!code,
      });
      await admin.from("payment_logs").insert({
        restaurant_id: st.restaurant_id,
        level: "error",
        message: "MP OAuth token exchange failed",
        data: {
          http_status: tokenRes.status,
          body: tokenJson,
          redirect_uri: REDIRECT_URI,
          client_id: appId,
          client_secret_present: !!mpClientSecret,
          client_secret_source: Deno.env.get("MP_CLIENT_SECRET") ? "MP_CLIENT_SECRET" : "MP_ACCESS_TOKEN_FALLBACK",
          code_verifier_found: !!st?.code_verifier,
        },
      });
      return redirect("/pagamentos?mp=error&reason=exchange_failed");
    }


    const expiresAt = tokenJson.expires_in
      ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
      : null;

    await admin.from("mercado_pago_accounts").upsert(
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

    await admin.from("oauth_states").update({ used_at: new Date().toISOString() }).eq("state", state);

    return redirect(st.redirect_to ?? "/pagamentos?mp=success");
  } catch (err) {
    console.error("[mp-oauth-callback] error", err);
    return redirect("/pagamentos?mp=error&reason=internal");
  }
});

function redirect(path: string) {
  const base = "https://app.rngdigital.com.br";
  const to = path.startsWith("http") ? path : base + path;
  return new Response(null, { status: 302, headers: { location: to, ...corsHeaders } });
}

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function sanitize(obj: Record<string, unknown>) {
  const clone = { ...obj };
  delete (clone as any).access_token;
  delete (clone as any).refresh_token;
  return clone;
}
