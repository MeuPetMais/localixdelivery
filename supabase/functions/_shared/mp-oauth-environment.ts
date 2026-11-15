/**
 * Mercado Pago OAuth token exchange mode.
 * Fail closed on unknown environments and on tokens that can operate in production.
 * https://www.mercadopago.com.br/developers/pt/reference/authentication/oauth/_oauth_token/post
 */
export function resolveMpOAuthTestToken(environment: string | undefined): "true" | "false" {
  if (environment === "test") return "true";
  if (environment === "production" || environment === "prod" || environment === "live") {
    return "false";
  }
  throw new Error("mp_oauth_environment_not_configured");
}

/**
 * Sandbox token responses may omit live_mode. Require a TEST token *and*
 * disallow an explicit live_mode=true. Do not accept APP_USR in test,
 * regardless of live_mode. Production requires APP_USR and live_mode=true.
 */
export function assertMpOAuthTokenMode(
  environment: string | undefined,
  liveMode: unknown,
  accessToken: unknown,
): void {
  const mode = resolveMpOAuthTestToken(environment);
  if (mode === "true") {
    if (typeof accessToken !== "string" || !accessToken.startsWith("TEST-") || liveMode === true) {
      throw new Error("oauth_test_environment_requires_sandbox_token");
    }
    if (liveMode !== undefined && liveMode !== null && liveMode !== false) {
      throw new Error("oauth_test_environment_requires_sandbox_token");
    }
    return;
  }
  if (typeof accessToken !== "string" || !accessToken.startsWith("APP_USR-") || liveMode !== true) {
    throw new Error("oauth_production_environment_requires_live_token");
  }
}
