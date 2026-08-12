import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  getMercadoPagoCheckoutProUrl,
  getRequiredMpEnvironmentConfig,
  getRequiredMpOAuthConfig,
  getRestaurantMpAccessToken,
  resolveMercadoPagoOAuthAccountEnvironment,
  validateMercadoPagoAccountEnvironment,
  verifyMercadoPagoWebhookSignature,
} from "../../../supabase/functions/_shared/mp-security";

function supabaseAccount(data: any) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data })),
        })),
      })),
    })),
  };
}

function env(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  };
}

async function signWebhook(secret: string, manifest: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function stagingMpConfig() {
  const result = getRequiredMpEnvironmentConfig(env({
    LOCALIX_ENV: "staging",
    LOCALIX_SUPABASE_ENVIRONMENT: "staging",
    MP_ENVIRONMENT: "sandbox",
    SUPABASE_URL: "https://dnotmvbhuqujvqdtgzav.supabase.co",
    APP_BASE_URL: "https://localixdelivery-staging.vercel.app",
    PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1",
    PRODUCTION_APP_BASE_URL: "https://localixdelivery.rngdigital.com.br",
  }));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

function productionMpConfig() {
  const result = getRequiredMpEnvironmentConfig(env({
    LOCALIX_ENV: "production",
    LOCALIX_SUPABASE_ENVIRONMENT: "production",
    MP_ENVIRONMENT: "production",
    SUPABASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co",
    APP_BASE_URL: "https://localixdelivery.rngdigital.com.br",
  }));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe("Mercado Pago security helpers", () => {
  it("staging com SUPABASE_URL valida gera URLs das Edge Functions", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "staging",
      LOCALIX_SUPABASE_ENVIRONMENT: "staging",
      MP_ENVIRONMENT: "sandbox",
      SUPABASE_URL: "https://dnotmvbhuqujvqdtgzav.supabase.co/",
      APP_BASE_URL: "https://localixdelivery-staging.vercel.app",
      PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1",
      PRODUCTION_APP_BASE_URL: "https://localixdelivery.rngdigital.com.br",
    }));

    expect(result).toMatchObject({
      ok: true,
      runtimeEnvironment: "staging",
      mercadoPagoEnvironment: "sandbox",
      functionsBaseUrl: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1",
      oauthRedirectUri: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1/mp-oauth-callback",
      webhookUrl: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1/mp-webhook",
    });
  });

  it("ignora LOCALIX_SUPABASE_FUNCTIONS_BASE_URL e usa SUPABASE_URL como fonte canonica", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "staging",
      LOCALIX_SUPABASE_ENVIRONMENT: "staging",
      MP_ENVIRONMENT: "sandbox",
      SUPABASE_URL: "https://dnotmvbhuqujvqdtgzav.supabase.co/",
      LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://custom-ref.supabase.co/functions/v1",
      APP_BASE_URL: "https://localixdelivery-staging.vercel.app",
      PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1",
      PRODUCTION_APP_BASE_URL: "https://localixdelivery.rngdigital.com.br",
    }));

    expect(result).toMatchObject({
      ok: true,
      functionsBaseUrl: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1",
      oauthRedirectUri: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1/mp-oauth-callback",
      webhookUrl: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1/mp-webhook",
    });
  });

  it("producao usa URLs de producao com MP production", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "production",
      LOCALIX_SUPABASE_ENVIRONMENT: "production",
      MP_ENVIRONMENT: "production",
      SUPABASE_URL: "https://prod-ref.supabase.co",
      APP_BASE_URL: "https://localixdelivery.rngdigital.com.br",
    }));

    expect(result).toMatchObject({
      ok: true,
      runtimeEnvironment: "production",
      mercadoPagoEnvironment: "production",
      oauthRedirectUri: "https://prod-ref.supabase.co/functions/v1/mp-oauth-callback",
      webhookUrl: "https://prod-ref.supabase.co/functions/v1/mp-webhook",
    });
  });

  it("production continua exigindo MP production", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "production",
      LOCALIX_SUPABASE_ENVIRONMENT: "production",
      MP_ENVIRONMENT: "sandbox",
      SUPABASE_URL: "https://prod-ref.supabase.co",
      APP_BASE_URL: "https://localixdelivery.rngdigital.com.br",
    }));

    expect(result).toEqual({
      ok: false,
      error: "mercadopago_environment_not_configured",
      reason: "production_requires_mp_production",
    });
  });

  it("staging sandbox usa fallback temporario quando SUPABASE_URL esta ausente", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "staging",
      LOCALIX_SUPABASE_ENVIRONMENT: "staging",
      MP_ENVIRONMENT: "sandbox",
      APP_BASE_URL: "https://localixdelivery-staging.vercel.app",
      PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1",
      PRODUCTION_APP_BASE_URL: "https://localixdelivery.rngdigital.com.br",
    }));

    expect(result).toMatchObject({
      ok: true,
      functionsBaseUrl: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1",
      oauthRedirectUri: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1/mp-oauth-callback",
      webhookUrl: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1/mp-webhook",
    });
    expect(JSON.stringify(result)).not.toContain("mvkfrwxgneqzvoabkaws");
  });

  it("staging sandbox usa fallback temporario quando SUPABASE_URL e invalida", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "staging",
      LOCALIX_SUPABASE_ENVIRONMENT: "staging",
      MP_ENVIRONMENT: "sandbox",
      SUPABASE_URL: "not a url",
      APP_BASE_URL: "https://localixdelivery-staging.vercel.app",
      PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1",
    }));

    expect(result).toMatchObject({
      ok: true,
      functionsBaseUrl: "https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1",
    });
  });

  it("development nao utiliza fallback temporario de staging", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "development",
      LOCALIX_SUPABASE_ENVIRONMENT: "development",
      MP_ENVIRONMENT: "sandbox",
      APP_BASE_URL: "http://localhost:5173",
    }));

    expect(result).toEqual({
      ok: false,
      error: "mercadopago_environment_not_configured",
      reason: "supabase_functions_base_url_missing_or_invalid",
    });
  });

  it("production nunca utiliza fallback temporario de staging", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "production",
      LOCALIX_SUPABASE_ENVIRONMENT: "production",
      MP_ENVIRONMENT: "production",
      APP_BASE_URL: "https://localixdelivery.rngdigital.com.br",
    }));

    expect(result).toEqual({
      ok: false,
      error: "mercadopago_environment_not_configured",
      reason: "supabase_functions_base_url_missing_or_invalid",
    });
  });

  it("staging nao aceita MP production", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "staging",
      LOCALIX_SUPABASE_ENVIRONMENT: "staging",
      MP_ENVIRONMENT: "production",
      SUPABASE_URL: "https://dnotmvbhuqujvqdtgzav.supabase.co",
      APP_BASE_URL: "https://staging.localix.test",
    }));

    expect(result).toEqual({
      ok: false,
      error: "mercadopago_environment_not_configured",
      reason: "non_production_requires_mp_sandbox",
    });
  });

  it("staging bloqueia quando referencia de producao esta ausente", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "staging",
      LOCALIX_SUPABASE_ENVIRONMENT: "staging",
      MP_ENVIRONMENT: "sandbox",
      SUPABASE_URL: "https://dnotmvbhuqujvqdtgzav.supabase.co",
      APP_BASE_URL: "https://localixdelivery-staging.vercel.app",
    }));

    expect(result).toEqual({
      ok: false,
      error: "mercadopago_environment_not_configured",
      reason: "production_supabase_reference_missing",
    });
  });

  it("staging com LOCALIX_SUPABASE_ENVIRONMENT divergente falha antes do fallback", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "staging",
      LOCALIX_SUPABASE_ENVIRONMENT: "production",
      MP_ENVIRONMENT: "sandbox",
      APP_BASE_URL: "https://localixdelivery-staging.vercel.app",
    }));

    expect(result).toEqual({
      ok: false,
      error: "mercadopago_environment_not_configured",
      reason: "runtime_supabase_environment_mismatch",
    });
  });

  it("staging nao reutiliza URLs marcadas como producao", () => {
    const result = getRequiredMpEnvironmentConfig(env({
      LOCALIX_ENV: "staging",
      LOCALIX_SUPABASE_ENVIRONMENT: "staging",
      MP_ENVIRONMENT: "sandbox",
      SUPABASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co",
      APP_BASE_URL: "https://staging.localix.test",
      PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1",
    }));

    expect(result).toEqual({
      ok: false,
      error: "mercadopago_environment_not_configured",
      reason: "staging_functions_url_matches_production",
    });
  });

  it("OAuth aceita staging sandbox com seller ID permitido", () => {
    expect(resolveMercadoPagoOAuthAccountEnvironment(
      { user_id: 3479408788, live_mode: true },
      env({ MP_STAGING_ALLOWED_SELLER_IDS: "3479408788" }),
      stagingMpConfig(),
    )).toEqual({
      ok: true,
      mpUserId: "3479408788",
      liveMode: true,
    });
  });

  it("OAuth rejeita staging sandbox com seller ID nao permitido", () => {
    expect(resolveMercadoPagoOAuthAccountEnvironment(
      { user_id: 9999999999, live_mode: false },
      env({ MP_STAGING_ALLOWED_SELLER_IDS: "3479408788" }),
      stagingMpConfig(),
    )).toEqual({
      ok: false,
      error: "mercadopago_account_not_allowed_in_staging",
    });
  });

  it("OAuth rejeita staging sandbox com allowlist ausente", () => {
    expect(resolveMercadoPagoOAuthAccountEnvironment(
      { user_id: 3479408788, live_mode: false },
      env({}),
      stagingMpConfig(),
    )).toEqual({
      ok: false,
      error: "mercadopago_staging_seller_allowlist_not_configured",
    });
  });

  it("OAuth rejeita staging sandbox com allowlist vazia", () => {
    expect(resolveMercadoPagoOAuthAccountEnvironment(
      { user_id: 3479408788, live_mode: false },
      env({ MP_STAGING_ALLOWED_SELLER_IDS: " , , " }),
      stagingMpConfig(),
    )).toEqual({
      ok: false,
      error: "mercadopago_staging_seller_allowlist_not_configured",
    });
  });

  it("OAuth aceita staging sandbox com varios seller IDs separados por virgula", () => {
    expect(resolveMercadoPagoOAuthAccountEnvironment(
      { user_id: 3479408788, live_mode: true },
      env({ MP_STAGING_ALLOWED_SELLER_IDS: "111, 3479408788, 222" }),
      stagingMpConfig(),
    )).toMatchObject({ ok: true, mpUserId: "3479408788" });
  });

  it("OAuth production nao depende da allowlist", () => {
    expect(resolveMercadoPagoOAuthAccountEnvironment(
      { user_id: 9999999999, live_mode: true },
      env({}),
      productionMpConfig(),
    )).toEqual({
      ok: true,
      mpUserId: "9999999999",
      liveMode: true,
    });
  });

  it("OAuth callback valida seller ID antes de persistir tokens", () => {
    const callback = readFileSync("supabase/functions/mp-oauth-callback/index.ts", "utf8");

    expect(callback.indexOf("resolveMercadoPagoOAuthAccountEnvironment")).toBeGreaterThan(-1);
    expect(callback.indexOf("resolveMercadoPagoOAuthAccountEnvironment")).toBeLessThan(
      callback.indexOf('admin.from("mercado_pago_accounts").upsert'),
    );
  });

  it("payment intent permite sandbox com seller permitido", () => {
    expect(validateMercadoPagoAccountEnvironment(
      { mp_user_id: "3479408788" },
      env({ MP_STAGING_ALLOWED_SELLER_IDS: "3479408788" }),
      stagingMpConfig(),
    )).toEqual({ ok: true });
  });

  it("payment intent bloqueia sandbox com seller nao permitido antes de prosseguir para API MP", () => {
    expect(validateMercadoPagoAccountEnvironment(
      { mp_user_id: "9999999999" },
      env({ MP_STAGING_ALLOWED_SELLER_IDS: "3479408788" }),
      stagingMpConfig(),
    )).toEqual({
      ok: false,
      error: "mercadopago_account_not_allowed_in_staging",
    });
  });

  it("payment intent valida seller ID da conta antes de obter token para chamadas MP", () => {
    const paymentIntent = readFileSync("supabase/functions/mp-payment-intent/index.ts", "utf8");
    const validationCall = paymentIntent.indexOf("await validatePaymentAccountEnvironment(sb, order.restaurant_id, environmentConfig)");

    expect(validationCall).toBeGreaterThan(-1);
    expect(validationCall).toBeLessThan(paymentIntent.indexOf("const token = await getAccessToken"));
    expect(validationCall).toBeGreaterThan(paymentIntent.indexOf("const environmentConfig = getRequiredMpEnvironmentConfig"));
  });

  it("payment intent production nao depende da allowlist", () => {
    expect(validateMercadoPagoAccountEnvironment(
      { mp_user_id: "9999999999" },
      env({}),
      productionMpConfig(),
    )).toEqual({ ok: true });
  });

  it("Checkout Pro em sandbox usa somente sandbox_init_point", () => {
    expect(getMercadoPagoCheckoutProUrl({
      init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=live",
      sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=test",
    }, stagingMpConfig())).toBe("https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=test");
  });

  it("Checkout Pro em sandbox nunca usa init_point como fallback", () => {
    expect(getMercadoPagoCheckoutProUrl({
      init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=live",
      sandbox_init_point: null,
    }, stagingMpConfig())).toBeNull();
  });

  it("Checkout Pro em production usa init_point", () => {
    expect(getMercadoPagoCheckoutProUrl({
      init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=live",
      sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=test",
    }, productionMpConfig())).toBe("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=live");
  });

  it("nenhum secret Mercado Pago e exposto como VITE_", () => {
    const example = readFileSync(".env.example", "utf8");

    expect(example).not.toMatch(/VITE_MP_(APP_ID|CLIENT_SECRET|WEBHOOK_SECRET|TOKEN_ENCRYPTION_KEY|ACCESS_TOKEN)/);
    expect(example).not.toMatch(/VITE_MERCADO_PAGO_(CLIENT_SECRET|WEBHOOK_SECRET|ACCESS_TOKEN)/);
  });

  it("usa token do restaurante MP conectado", async () => {
    const sb = supabaseAccount({
      connected: true,
      access_token: "encrypted-token",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    const decrypt = vi.fn(async () => "restaurant-token");

    await expect(getRestaurantMpAccessToken(sb, "restaurant-1", decrypt)).resolves.toEqual({
      ok: true,
      token: "restaurant-token",
    });
    expect(decrypt).toHaveBeenCalledWith("encrypted-token");
  });

  it("bloqueia restaurante MP nao conectado", async () => {
    const sb = supabaseAccount({ connected: false, access_token: "encrypted-token" });

    await expect(getRestaurantMpAccessToken(sb, "restaurant-1", vi.fn())).resolves.toEqual({
      ok: false,
      error: "restaurant_mp_not_connected",
    });
  });

  it("bloqueia token ausente", async () => {
    const sb = supabaseAccount({ connected: true, access_token: null });

    await expect(getRestaurantMpAccessToken(sb, "restaurant-1", vi.fn())).resolves.toEqual({
      ok: false,
      error: "restaurant_mp_not_connected",
    });
  });

  it("bloqueia token expirado", async () => {
    const sb = supabaseAccount({
      connected: true,
      access_token: "encrypted-token",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    await expect(getRestaurantMpAccessToken(sb, "restaurant-1", vi.fn())).resolves.toEqual({
      ok: false,
      error: "restaurant_mp_token_expired",
    });
  });

  it("bloqueia webhook sem restaurante identificavel", async () => {
    const sb = supabaseAccount(null);

    await expect(getRestaurantMpAccessToken(sb, null, vi.fn())).resolves.toEqual({
      ok: false,
      error: "restaurant_mp_not_connected",
    });
  });

  it("exige MP_CLIENT_SECRET explicitamente", () => {
    const env = { get: (key: string) => (key === "MP_APP_ID" ? "app-id" : undefined) };

    expect(getRequiredMpOAuthConfig(env)).toEqual({
      ok: false,
      error: "mercadopago_client_secret_missing",
    });
  });

  it("aceita OAuth valido com app id e client secret", () => {
    const env = {
      get: (key: string) => ({ MP_APP_ID: "app-id", MP_CLIENT_SECRET: "client-secret" })[key],
    };

    expect(getRequiredMpOAuthConfig(env)).toEqual({
      ok: true,
      appId: "app-id",
      clientSecret: "client-secret",
    });
  });

  it("falha OAuth quando MP_APP_ID esta ausente", () => {
    const env = { get: (key: string) => (key === "MP_CLIENT_SECRET" ? "client-secret" : undefined) };

    expect(getRequiredMpOAuthConfig(env)).toEqual({
      ok: false,
      error: "mercadopago_app_id_missing",
    });
  });

  it("aceita webhook valido", async () => {
    const secret = "webhook-secret";
    const manifest = "id:123;request-id:req-1;ts:1700000000;";
    const signature = await signWebhook(secret, manifest);

    await expect(
      verifyMercadoPagoWebhookSignature({
        secret,
        xSignature: `ts=1700000000,v1=${signature}`,
        xRequestId: "req-1",
        dataIdFromQuery: "123",
        dataIdFromBody: null,
      }),
    ).resolves.toMatchObject({ ok: true, dataId: "123" });
  });

  it("rejeita webhook com assinatura invalida", async () => {
    await expect(
      verifyMercadoPagoWebhookSignature({
        secret: "webhook-secret",
        xSignature: "ts=1700000000,v1=deadbeef",
        xRequestId: "req-1",
        dataIdFromQuery: "123",
        dataIdFromBody: null,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "length_mismatch" });
  });
});
