import { describe, expect, it } from "vitest";
import { resolveMpOAuthRedirectUri, resolveMpOAuthAppRedirect } from "./mp-oauth-url";

const HOMO = "https://gvozcqyjhogmvebrwzap.supabase.co";
const PROD = "https://mvkfrwxgneqzvoabkaws.supabase.co";
const CALLBACK = `${HOMO}/functions/v1/mp-oauth-callback`;
const APP = "https://preview.localix.example";

describe("Gate 4: Mercado Pago OAuth environment isolation", () => {
  it("uses isolated project callback only when explicitly configured", () => {
    expect(resolveMpOAuthRedirectUri(HOMO, CALLBACK)).toBe(CALLBACK);
  });

  it("rejects missing callback configuration instead of falling back to Production", () => {
    expect(() => resolveMpOAuthRedirectUri(HOMO, undefined)).toThrow(
      "mp_oauth_redirect_not_configured",
    );
    expect(() => resolveMpOAuthRedirectUri(undefined, CALLBACK)).toThrow(
      "mp_oauth_redirect_not_configured",
    );
  });

  it("blocks Production callback when deployed in isolated sandbox", () => {
    expect(() => resolveMpOAuthRedirectUri(HOMO, `${PROD}/functions/v1/mp-oauth-callback`)).toThrow(
      "mp_oauth_redirect_environment_mismatch",
    );
  });

  it("does not accept arbitrary callback paths or query values", () => {
    expect(() => resolveMpOAuthRedirectUri(HOMO, HOMO + "/functions/v1/another")).toThrow();
    expect(() =>
      resolveMpOAuthRedirectUri(HOMO, CALLBACK + "?redirect=https://evil.example"),
    ).toThrow();
    expect(() => resolveMpOAuthRedirectUri("http://localhost:54321", CALLBACK)).toThrow();
  });

  it("permits only relative or same-origin HTTPS application returns", () => {
    expect(resolveMpOAuthAppRedirect(APP, "/pagamentos?mp=success", true)).toBe(
      APP + "/pagamentos?mp=success",
    );
    expect(resolveMpOAuthAppRedirect(APP, APP + "/settings", true)).toBe(APP + "/settings");
  });

  it("blocks other origins, protocol-relative destinations and JS redirects", () => {
    for (const to of [
      "https://localixdelivery.rngdigital.com.br/pagamentos",
      "https://evil.example",
      "//evil.example",
      "javascript:alert(1)",
      "/\\\\evil.example",
    ]) {
      expect(() => resolveMpOAuthAppRedirect(APP, to, true)).toThrow();
    }
  });

  it("fails closed when APP_URL is missing instead of redirecting to Production", () => {
    expect(() => resolveMpOAuthAppRedirect(undefined, "/pagamentos", true)).toThrow(
      "mp_oauth_app_url_not_configured",
    );
  });
});
