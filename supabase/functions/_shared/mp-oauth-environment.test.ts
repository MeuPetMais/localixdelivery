import { describe, expect, it } from "vitest";
import { assertMpOAuthTokenMode, resolveMpOAuthTestToken } from "./mp-oauth-environment";

describe("Gate 4: Mercado Pago sandbox OAuth token exchange", () => {
  it("requests a sandbox token only in test environment", () => {
    expect(resolveMpOAuthTestToken("test")).toBe("true");
  });

  it("does not silently default to production", () => {
    for (const environment of [undefined, "", "staging", "sandbox", "TEST"]) {
      expect(() => resolveMpOAuthTestToken(environment)).toThrow(
        "mp_oauth_environment_not_configured",
      );
    }
  });

  it("preserves explicitly selected production mode", () => {
    expect(resolveMpOAuthTestToken("production")).toBe("false");
    expect(resolveMpOAuthTestToken("prod")).toBe("false");
    expect(resolveMpOAuthTestToken("live")).toBe("false");
  });

  it("requires a confirmed live_mode false response in test", () => {
    expect(() => assertMpOAuthTokenMode("test", false)).not.toThrow();
    for (const mode of [true, null, undefined, "false"]) {
      expect(() => assertMpOAuthTokenMode("test", mode)).toThrow(
        "oauth_test_environment_requires_sandbox_token",
      );
    }
  });

  it("rejects sandbox/undetermined tokens in production mode", () => {
    expect(() => assertMpOAuthTokenMode("production", true)).not.toThrow();
    for (const mode of [false, null, undefined]) {
      expect(() => assertMpOAuthTokenMode("production", mode)).toThrow(
        "oauth_production_environment_requires_live_token",
      );
    }
  });
});
