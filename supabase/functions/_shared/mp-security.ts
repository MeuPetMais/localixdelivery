export type MpTokenError =
  | "restaurant_mp_not_connected"
  | "restaurant_mp_token_invalid"
  | "restaurant_mp_token_expired";

export type MpTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: MpTokenError };

export type MpAccountClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data: {
            access_token?: string | null;
            connected?: boolean | null;
            expires_at?: string | null;
          } | null;
          error?: { message?: string } | null;
        }>;
      };
    };
  };
};

export async function getRestaurantMpAccessToken(
  sb: MpAccountClient,
  restaurantId: string | null | undefined,
  decrypt: (encrypted: string) => Promise<string | null>,
): Promise<MpTokenResult> {
  if (!restaurantId) return { ok: false, error: "restaurant_mp_not_connected" };

  const { data } = await sb
    .from("mercado_pago_accounts")
    .select("access_token, connected, expires_at")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!data?.connected || !data.access_token) {
    return { ok: false, error: "restaurant_mp_not_connected" };
  }

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "restaurant_mp_token_expired" };
  }

  const token = await decrypt(data.access_token);
  if (!token) return { ok: false, error: "restaurant_mp_token_invalid" };

  return { ok: true, token };
}

export type MpOAuthConfig =
  | { ok: true; appId: string; clientSecret: string }
  | { ok: false; error: "mercadopago_app_id_missing" | "mercadopago_client_secret_missing" };

export type LocalixRuntimeEnvironment = "development" | "staging" | "production";
export type MercadoPagoRuntimeEnvironment = "sandbox" | "production";

export type MpEnvironmentConfig =
  | {
      ok: true;
      runtimeEnvironment: LocalixRuntimeEnvironment;
      supabaseEnvironment: LocalixRuntimeEnvironment;
      mercadoPagoEnvironment: MercadoPagoRuntimeEnvironment;
      functionsBaseUrl: string;
      oauthRedirectUri: string;
      webhookUrl: string;
      appBaseUrl: string;
    }
  | { ok: false; error: "mercadopago_environment_not_configured"; reason: string };

export const MP_LIVE_ACCOUNT_NOT_ALLOWED_IN_STAGING = "mercadopago_live_account_not_allowed_in_staging";

const TEMPORARY_STAGING_FUNCTIONS_BASE_URL = "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1";

function cleanEnvValue(value: string | undefined | null): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function deriveFunctionsBaseUrl(supabaseUrl: string): string {
  return `${normalizeUrl(supabaseUrl)}/functions/v1`;
}

function parseLocalixEnvironment(value: string | null): LocalixRuntimeEnvironment | null {
  if (value === "development" || value === "staging" || value === "production") return value;
  return null;
}

function parseMpEnvironment(value: string | null): MercadoPagoRuntimeEnvironment | null {
  if (value === "sandbox" || value === "production") return value;
  return null;
}

function isValidBaseUrl(value: string, env: LocalixRuntimeEnvironment): boolean {
  try {
    const url = new URL(value);
    if (env === "production" || env === "staging") return url.protocol === "https:";
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function equalsNormalizedUrl(left: string | null, right: string | null): boolean {
  return Boolean(left && right && normalizeUrl(left) === normalizeUrl(right));
}

function getUrlOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getRequiredMpEnvironmentConfig(env: { get: (key: string) => string | undefined | null }): MpEnvironmentConfig {
  const runtimeEnvironment = parseLocalixEnvironment(cleanEnvValue(env.get("LOCALIX_ENV")));
  if (!runtimeEnvironment) {
    return { ok: false, error: "mercadopago_environment_not_configured", reason: "localix_env_missing_or_invalid" };
  }

  const supabaseEnvironment = parseLocalixEnvironment(cleanEnvValue(env.get("LOCALIX_SUPABASE_ENVIRONMENT")));
  if (!supabaseEnvironment) {
    return { ok: false, error: "mercadopago_environment_not_configured", reason: "supabase_environment_missing_or_invalid" };
  }

  const mercadoPagoEnvironment = parseMpEnvironment(cleanEnvValue(env.get("MP_ENVIRONMENT")));
  if (!mercadoPagoEnvironment) {
    return { ok: false, error: "mercadopago_environment_not_configured", reason: "mp_environment_missing_or_invalid" };
  }

  if (runtimeEnvironment !== supabaseEnvironment) {
    return { ok: false, error: "mercadopago_environment_not_configured", reason: "runtime_supabase_environment_mismatch" };
  }

  if (runtimeEnvironment === "production" && mercadoPagoEnvironment !== "production") {
    return { ok: false, error: "mercadopago_environment_not_configured", reason: "production_requires_mp_production" };
  }

  if (runtimeEnvironment !== "production" && mercadoPagoEnvironment !== "sandbox") {
    return { ok: false, error: "mercadopago_environment_not_configured", reason: "non_production_requires_mp_sandbox" };
  }

  const supabaseUrl = cleanEnvValue(env.get("SUPABASE_URL"));
  let functionsBaseUrl: string | null = null;
  if (supabaseUrl && isValidBaseUrl(supabaseUrl, runtimeEnvironment)) {
    functionsBaseUrl = deriveFunctionsBaseUrl(supabaseUrl);
  } else if (
    runtimeEnvironment === "staging" &&
    supabaseEnvironment === "staging" &&
    mercadoPagoEnvironment === "sandbox"
  ) {
    // TEMPORARY STAGING FALLBACK — remove before production rollout.
    functionsBaseUrl = TEMPORARY_STAGING_FUNCTIONS_BASE_URL;
  }

  if (!functionsBaseUrl) {
    return { ok: false, error: "mercadopago_environment_not_configured", reason: "supabase_functions_base_url_missing_or_invalid" };
  }

  const appBaseUrl = cleanEnvValue(env.get("APP_BASE_URL")) ?? cleanEnvValue(env.get("APP_URL"));
  if (!appBaseUrl || !isValidBaseUrl(appBaseUrl, runtimeEnvironment)) {
    return { ok: false, error: "mercadopago_environment_not_configured", reason: "app_base_url_missing_or_invalid" };
  }

  if (runtimeEnvironment === "staging") {
    const currentSupabaseOrigin = getUrlOrigin(supabaseUrl);
    const productionFunctionsBaseUrl = cleanEnvValue(env.get("PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL"));
    const productionSupabaseOrigin = getUrlOrigin(productionFunctionsBaseUrl);
    if (!productionSupabaseOrigin) {
      return { ok: false, error: "mercadopago_environment_not_configured", reason: "production_supabase_reference_missing" };
    }

    if (currentSupabaseOrigin && currentSupabaseOrigin === productionSupabaseOrigin) {
      return { ok: false, error: "mercadopago_environment_not_configured", reason: "staging_functions_url_matches_production" };
    }

    const productionAppBaseUrl = cleanEnvValue(env.get("PRODUCTION_APP_BASE_URL"));
    if (equalsNormalizedUrl(appBaseUrl, productionAppBaseUrl)) {
      return { ok: false, error: "mercadopago_environment_not_configured", reason: "staging_app_url_matches_production" };
    }
  }

  const normalizedFunctionsBaseUrl = normalizeUrl(functionsBaseUrl);
  return {
    ok: true,
    runtimeEnvironment,
    supabaseEnvironment,
    mercadoPagoEnvironment,
    functionsBaseUrl: normalizedFunctionsBaseUrl,
    oauthRedirectUri: `${normalizedFunctionsBaseUrl}/mp-oauth-callback`,
    webhookUrl: `${normalizedFunctionsBaseUrl}/mp-webhook`,
    appBaseUrl: normalizeUrl(appBaseUrl),
  };
}

export function getRequiredMpOAuthConfig(env: { get: (key: string) => string | undefined | null }): MpOAuthConfig {
  const appId = env.get("MP_APP_ID");
  if (!appId) return { ok: false, error: "mercadopago_app_id_missing" };

  const clientSecret = env.get("MP_CLIENT_SECRET");
  if (!clientSecret) return { ok: false, error: "mercadopago_client_secret_missing" };

  return { ok: true, appId, clientSecret };
}

export function resolveMercadoPagoOAuthLiveMode(
  tokenJson: { live_mode?: unknown },
  environmentConfig: Extract<MpEnvironmentConfig, { ok: true }>,
): { ok: true; liveMode: boolean } | { ok: false; error: typeof MP_LIVE_ACCOUNT_NOT_ALLOWED_IN_STAGING } {
  if (environmentConfig.runtimeEnvironment === "staging" && environmentConfig.mercadoPagoEnvironment === "sandbox") {
    if (tokenJson.live_mode !== false) return { ok: false, error: MP_LIVE_ACCOUNT_NOT_ALLOWED_IN_STAGING };
    return { ok: true, liveMode: false };
  }

  return { ok: true, liveMode: tokenJson.live_mode === false ? false : true };
}

export function validateMercadoPagoAccountEnvironment(
  account: { live_mode?: boolean | null } | null | undefined,
  environmentConfig: Extract<MpEnvironmentConfig, { ok: true }>,
): { ok: true } | { ok: false; error: typeof MP_LIVE_ACCOUNT_NOT_ALLOWED_IN_STAGING } {
  if (!account) return { ok: true };

  if (environmentConfig.runtimeEnvironment === "staging" && environmentConfig.mercadoPagoEnvironment === "sandbox") {
    if (account?.live_mode !== false) return { ok: false, error: MP_LIVE_ACCOUNT_NOT_ALLOWED_IN_STAGING };
  }

  return { ok: true };
}

export function getMercadoPagoCheckoutProUrl(
  preference: { init_point?: string | null; sandbox_init_point?: string | null },
  environmentConfig: Extract<MpEnvironmentConfig, { ok: true }>,
): string | null {
  if (environmentConfig.mercadoPagoEnvironment === "sandbox") {
    return preference.sandbox_init_point ?? null;
  }

  return preference.init_point ?? null;
}

export type MpSignatureResult = {
  ok: boolean;
  reason?: string;
  manifest?: string;
  dataId?: string;
  ts?: string;
};

export async function verifyMercadoPagoWebhookSignature(opts: {
  secret: string | null;
  xSignature: string | null;
  xRequestId: string | null;
  dataIdFromQuery: string | null;
  dataIdFromBody: string | null;
}): Promise<MpSignatureResult> {
  if (!opts.secret) return { ok: false, reason: "missing_secret" };
  if (!opts.xSignature) return { ok: false, reason: "missing_x_signature_header" };

  const parts: Record<string, string> = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, ...r] = p.trim().split("=");
      return [k.trim(), r.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = (parts.v1 ?? "").toLowerCase();
  if (!ts) return { ok: false, reason: "missing_ts_in_x_signature" };
  if (!v1) return { ok: false, reason: "missing_v1_in_x_signature" };

  const rawDataId = opts.dataIdFromQuery ?? opts.dataIdFromBody ?? "";
  if (!rawDataId) return { ok: false, reason: "missing_data_id" };
  const dataId = rawDataId.toLowerCase();
  const requestId = opts.xRequestId ?? "";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(opts.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (hex.length !== v1.length) {
    return { ok: false, reason: "length_mismatch", manifest, dataId, ts };
  }

  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  if (diff !== 0) return { ok: false, reason: "hmac_mismatch", manifest, dataId, ts };

  return { ok: true, manifest, dataId, ts };
}
