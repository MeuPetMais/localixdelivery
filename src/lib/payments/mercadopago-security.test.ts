import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  getMercadoPagoCheckoutProUrl,
  getRequiredMpEnvironmentConfig,
  getRequiredMpOAuthConfig,
  getRestaurantMpAccessToken,
  resolveMercadoPagoOAuthAccountEnvironment,
  resolveMercadoPagoPaymentAccessToken,
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

function paymentIntentSource() {
  return readFileSync("supabase/functions/mp-payment-intent/index.ts", "utf8");
}

function persistPaymentSplitSource() {
  const source = paymentIntentSource();
  const start = source.indexOf("async function persistPaymentSplit");
  const end = source.indexOf("function admin()");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function paymentSplitHelperSource() {
  return readFileSync("supabase/functions/_shared/payment-split.ts", "utf8");
}

function mpWebhookSource() {
  return readFileSync("supabase/functions/mp-webhook/index.ts", "utf8");
}

function splitFunctionsSource() {
  return readFileSync("src/lib/payments/split.functions.ts", "utf8");
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
    expect(validationCall).toBeLessThan(paymentIntent.indexOf("const sellerOAuthToken = shouldUsePixSandboxTestToken"));
    expect(validationCall).toBeGreaterThan(paymentIntent.indexOf("const environmentConfig = getRequiredMpEnvironmentConfig"));
  });

  it("staging sandbox PIX usa MP_TEST_ACCESS_TOKEN e nao OAuth seller", () => {
    expect(resolveMercadoPagoPaymentAccessToken({
      env: env({ MP_TEST_ACCESS_TOKEN: "TEST-application-token", MP_ACCESS_TOKEN: "LIVE-token-never-used" }),
      environmentConfig: stagingMpConfig(),
      paymentMethod: "pix",
      sellerOAuthToken: "seller-oauth-token",
    })).toEqual({
      ok: true,
      token: "TEST-application-token",
      source: "mp_test_access_token",
    });
  });

  it("staging sandbox PIX sem MP_TEST_ACCESS_TOKEN falha fechado sem fallback para OAuth seller", () => {
    expect(resolveMercadoPagoPaymentAccessToken({
      env: env({}),
      environmentConfig: stagingMpConfig(),
      paymentMethod: "pix",
      sellerOAuthToken: "seller-oauth-token",
    })).toEqual({
      ok: false,
      error: "mercadopago_test_access_token_not_configured",
    });
  });

  it("production usa OAuth seller e ignora MP_TEST_ACCESS_TOKEN", () => {
    expect(resolveMercadoPagoPaymentAccessToken({
      env: env({ MP_TEST_ACCESS_TOKEN: "TEST-application-token" }),
      environmentConfig: productionMpConfig(),
      paymentMethod: "pix",
      sellerOAuthToken: "seller-oauth-token",
    })).toEqual({
      ok: true,
      token: "seller-oauth-token",
      source: "seller_oauth",
    });
  });

  it("Checkout Pro nao usa MP_TEST_ACCESS_TOKEN em staging sandbox", () => {
    expect(resolveMercadoPagoPaymentAccessToken({
      env: env({ MP_TEST_ACCESS_TOKEN: "TEST-application-token" }),
      environmentConfig: stagingMpConfig(),
      paymentMethod: "credit_card",
      sellerOAuthToken: "seller-oauth-token",
    })).toEqual({
      ok: true,
      token: "seller-oauth-token",
      source: "seller_oauth",
    });
  });

  it("payment intent PIX sandbox falha antes de OAuth seller quando test token esta ausente", () => {
    const paymentIntent = readFileSync("supabase/functions/mp-payment-intent/index.ts", "utf8");
    const security = readFileSync("supabase/functions/_shared/mp-security.ts", "utf8");

    expect(paymentIntent).toContain("const sellerOAuthToken = shouldUsePixSandboxTestToken");
    expect(paymentIntent).toContain("? null");
    expect(security).toContain("mercadopago_test_access_token_not_configured");
  });

  it("payment intent mantem application_fee do snapshot e transaction_amount do customer_total", () => {
    const paymentIntent = paymentIntentSource();

    expect(paymentIntent).toContain("transactionAmount: snapshot.customer_total");
    expect(paymentIntent).toContain("platformFee: snapshot.platform_fee");
    expect(paymentIntent).toContain("applicationFee: splitAmounts.feeForGateway");
    expect(paymentIntent).toContain("body.application_fee = Number(params.applicationFee.toFixed(2))");
  });

  it("payment intent captura e propaga falha de persistencia do payment_split", () => {
    const persistSplit = persistPaymentSplitSource();

    expect(persistSplit).toContain("const { error } = await persistPaymentSplitByOrder");
    expect(persistSplit).toContain('if (error) {');
    expect(persistSplit).toContain('[mp-payment-intent][payment-split] persist failed');
    expect(persistSplit).toContain('throw new Error("mercadopago_payment_split_persist_failed")');
  });

  it("payment_split nao usa upsert por onConflict parcial de order_id nos writers Mercado Pago", () => {
    const paymentIntent = paymentIntentSource();
    const webhook = mpWebhookSource();
    const splitFns = splitFunctionsSource();

    expect(paymentIntent).not.toContain('.from("payment_split").upsert');
    expect(webhook).not.toContain('.from("payment_split").upsert');
    expect(splitFns).not.toContain('.from("payment_split").upsert');
    expect(paymentIntent).toContain("persistPaymentSplitByOrder");
    expect(webhook).toContain("persistPaymentSplitByOrderOrThrow");
    expect(splitFns).toContain("async function persistPaymentSplitByOrder");
  });

  it("schema local de payment_split possui apenas indice unico parcial para order_id", () => {
    const migration = readFileSync(
      "supabase/migrations/20260703001630_31ce2cfe-5d1a-4394-a0bd-749d1f3e6ac7.sql",
      "utf8",
    );

    expect(migration).toContain("CREATE UNIQUE INDEX uq_payment_split_order ON public.payment_split(order_id) WHERE order_id IS NOT NULL");
    expect(migration).not.toMatch(/ALTER TABLE public\.payment_split\s+ADD CONSTRAINT[\s\S]*UNIQUE\s*\(order_id\)/i);
  });

  it("payment_split persiste de forma idempotente por order_id e retry nao duplica split", () => {
    const helper = paymentSplitHelperSource();

    expect(helper).toContain('.from("payment_split")');
    expect(helper).toContain('.eq("order_id", row.order_id)');
    expect(helper).toContain('.insert(row)');
    expect(helper).toContain("uniqueViolation(insertError)");
    expect(helper).toContain("updatePaymentSplitByOrder(sb, row)");
    expect(helper).not.toContain("onConflict");
  });

  it("payment intent loga sucesso de payment_split sem alterar o fluxo", () => {
    const paymentIntent = paymentIntentSource();
    const persistSplit = persistPaymentSplitSource();
    const orderPaymentUpsert = paymentIntent.indexOf('const { data: postUp, error: postErr } = await sb.from("order_payment").upsert');
    const splitPersist = paymentIntent.indexOf("await persistPaymentSplit(sb, {", orderPaymentUpsert);

    expect(persistSplit).toContain("[mp-payment-intent][payment-split] persisted");
    expect(persistSplit).toContain("order_id: params.orderId");
    expect(persistSplit).toContain("status: params.status");
    expect(persistSplit).toContain("gateway_status: params.gatewayStatus ?? null");
    expect(orderPaymentUpsert).toBeGreaterThan(-1);
    expect(splitPersist).toBeGreaterThan(orderPaymentUpsert);
  });

  it("payment_split PIX PENDING continua sendo PROCESSING e usa valores do snapshot", () => {
    const paymentIntent = paymentIntentSource();
    const pixSuccessSplit = paymentIntent.slice(
      paymentIntent.indexOf("await persistPaymentSplit(sb, {", paymentIntent.indexOf("await syncOrderStatusFromPayment")),
      paymentIntent.indexOf("// Tamb", paymentIntent.indexOf("await syncOrderStatusFromPayment")),
    );

    expect(pixSuccessSplit).toContain('status: "PROCESSING"');
    expect(pixSuccessSplit).toContain("snapshot,");
    expect(pixSuccessSplit).toContain("gatewayStatus: mp?.status ?? null");
  });

  it("webhook Mercado Pago reconcilia PROCESSING sem reconhecer receita realizada enquanto pendente", () => {
    const webhook = mpWebhookSource();
    const pendingBranch = webhook.slice(
      webhook.indexOf('if (params.localStatus === "PENDING" || params.localStatus === "PROCESSING")'),
      webhook.indexOf('if (params.localStatus === "REJECTED"', webhook.indexOf('if (params.localStatus === "PENDING" || params.localStatus === "PROCESSING")')),
    );

    expect(pendingBranch).toContain('status: "PROCESSING"');
    expect(pendingBranch).toContain("persistPaymentSplitByOrderOrThrow");
    expect(pendingBranch).not.toContain("realized_platform_revenue");
  });

  it("webhook Mercado Pago so reconhece realized_platform_revenue apos reconciliacao valida", () => {
    const webhook = mpWebhookSource();

    expect(webhook).toContain('status = matches ? "COMPLETED" : "MANUAL_REVIEW"');
    expect(webhook).toContain("update({ realized_platform_revenue: extraction.amount })");
    expect(webhook.indexOf("update({ realized_platform_revenue: extraction.amount })")).toBeGreaterThan(
      webhook.indexOf("const matches = extraction.ok"),
    );
  });

  it("webhook Mercado Pago preserva FAILED e MANUAL_REVIEW na reconciliacao", () => {
    const webhook = mpWebhookSource();

    expect(webhook).toContain('status: "FAILED"');
    expect(webhook).toContain('status: "MANUAL_REVIEW"');
    expect(webhook).toContain("split_chargeback_reconciliation_required");
    expect(webhook).toContain("invalid_platform_fee");
  });

  it("payment_split logs nao incluem tokens, headers, dados pessoais nem QR Code", () => {
    const persistSplit = persistPaymentSplitSource();

    expect(persistSplit).not.toMatch(/access_token|refresh_token|Authorization|headers|payer_email|customer_name|customer_phone|address|qr_code|qr_code_base64/i);
    expect(persistSplit).toContain("order_id");
    expect(persistSplit).toContain("transaction_amount");
    expect(persistSplit).toContain("platform_fee");
    expect(persistSplit).toContain("restaurant_amount");
    expect(persistSplit).toContain("gateway_fee");
  });

  it("logs nao incluem token e documentam limite do PIX sandbox com test token", () => {
    const paymentIntent = paymentIntentSource();

    expect(paymentIntent).toContain("token_source");
    expect(paymentIntent).toContain("pix_sandbox_test_token_validates_payment_creation_and_fee_payload_not_full_oauth_split");
    expect(paymentIntent).not.toContain("access_token:");
    expect(paymentIntent).not.toContain("MP_TEST_ACCESS_TOKEN:");
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
