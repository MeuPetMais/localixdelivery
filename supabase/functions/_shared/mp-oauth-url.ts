/**
 * Mercado Pago OAuth URLs — fail closed and scoped to the current Supabase project.
 * No production fallback and no caller-provided redirect_uri.
 */
export function resolveMpOAuthRedirectUri(
  supabaseUrl: string | undefined,
  configuredRedirectUri: string | undefined,
): string {
  if (!supabaseUrl || !configuredRedirectUri) {
    throw new Error("mp_oauth_redirect_not_configured");
  }
  const base = new URL(supabaseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("mp_oauth_invalid_supabase_url");
  }
  if (!/^[a-z0-9-]+\.supabase\.co$/i.test(base.hostname) || base.port || base.pathname !== "/") {
    throw new Error("mp_oauth_untrusted_supabase_origin");
  }
  const expected = `${base.origin}/functions/v1/mp-oauth-callback`;
  if (configuredRedirectUri !== expected) {
    throw new Error("mp_oauth_redirect_environment_mismatch");
  }
  return expected;
}

/**
 * A stored redirect is a navigation hint only, never an arbitrary redirect target.
 * Only relative app paths, or absolute https URLs on the configured APP_URL origin.
 */
export function resolveMpOAuthAppRedirect(
  appUrl: string | undefined,
  requestedPath: string | null | undefined,
  success: boolean,
): string {
  if (!appUrl) throw new Error("mp_oauth_app_url_not_configured");
  const app = new URL(appUrl);
  if (
    app.protocol !== "https:" ||
    app.username ||
    app.password ||
    app.search ||
    app.hash ||
    app.pathname !== "/" ||
    app.port
  ) {
    throw new Error("mp_oauth_invalid_app_url");
  }
  const fallback = success ? "/pagamentos?mp=success" : "/pagamentos?mp=error&reason=internal";
  const path = requestedPath || fallback;
  if (path.startsWith("//") || path.startsWith("\\\\") || path.includes("\\")) {
    throw new Error("mp_oauth_untrusted_app_redirect");
  }
  const result = new URL(path, app.origin);
  if (result.origin !== app.origin || result.protocol !== "https:") {
    throw new Error("mp_oauth_untrusted_app_redirect");
  }
  return result.href;
}
