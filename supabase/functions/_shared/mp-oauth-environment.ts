/**
 * Mercado Pago OAuth token exchange mode.
 * Never infer production mode from an absent environment variable.
 * https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation
 */
export function resolveMpOAuthTestToken(environment: string | undefined): "true" | "false" {
  if (environment === "test") return "true";
  if (environment === "production" || environment === "prod" || environment === "live") {
    return "false";
  }
  throw new Error("mp_oauth_environment_not_configured");
}

export function assertMpOAuthTokenMode(
  environment: string | undefined,
  liveMode: unknown,
): void {
  const expected = resolveMpOAuthTestToken(environment);
  if (expected === "true" && liveMode !== false) {
    throw new Error("oauth_test_environment_requires_sandbox_token");
  }
  if (expected === "false" && liveMode !== true) {
    throw new Error("oauth_production_environment_requires_live_token");
  }
}
