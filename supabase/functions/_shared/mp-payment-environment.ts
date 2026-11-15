/**
 * Authoritative Mercado Pago payment environment guard.
 * Prevents a sandbox payment from targeting the production webhook or a live seller.
 */
export function resolveMpPaymentWebhookUrl(
  supabaseUrl: string | undefined,
  mpEnvironment: string | undefined,
): string {
  if (!supabaseUrl || !mpEnvironment) throw new Error("mp_payment_environment_not_configured");
  if (mpEnvironment !== "test" && mpEnvironment !== "production") {
    throw new Error("mp_payment_invalid_environment");
  }
  const url = new URL(supabaseUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    url.pathname !== "/" ||
    !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)
  ) {
    throw new Error("mp_payment_invalid_supabase_origin");
  }
  if (mpEnvironment === "test" && url.hostname === "mvkfrwxgneqzvoabkaws.supabase.co") {
    throw new Error("mp_payment_test_must_not_use_production");
  }
  return `${url.origin}/functions/v1/mp-webhook`;
}

export function assertMpSellerTokenMode(
  environment: string | undefined,
  liveMode: unknown,
  accessToken: unknown,
): void {
  if (environment !== "test" && environment !== "production") {
    throw new Error("mp_payment_environment_not_configured");
  }
  const token = typeof accessToken === "string" ? accessToken : "";
  if (environment === "test") {
    if (liveMode !== false || !token.startsWith("TEST-")) {
      throw new Error("mp_payment_seller_token_not_sandbox");
    }
    return;
  }
  if (liveMode !== true || !token.startsWith("APP_USR-")) {
    throw new Error("mp_payment_seller_token_not_production");
  }
}
