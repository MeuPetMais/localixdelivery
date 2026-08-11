import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  getRequiredMpEnvironmentConfig,
  getRequiredMpOAuthConfig,
  getRestaurantMpAccessToken,
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
