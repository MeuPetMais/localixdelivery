import { describe, expect, it } from "vitest";
import { assertMpOAuthTokenMode, resolveMpOAuthTestToken } from "./mp-oauth-environment";

const TEST_TOKEN = "TEST-synthetic-not-a-real-token";
const LIVE_TOKEN = "APP_USR-synthetic-not-a-real-token";

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

  it("accepts a TEST-prefixed token with false or absent live_mode", () => {
    for (const mode of [false, null, undefined]) {
      expect(() => assertMpOAuthTokenMode("test", mode, TEST_TOKEN)).not.toThrow();
    }
  });

  it("rejects explicit live_mode true and non-boolean values in test", () => {
    for (const mode of [true, "false", "true", 0, 1]) {
      expect(() => assertMpOAuthTokenMode("test", mode, TEST_TOKEN)).toThrow(
        "oauth_test_environment_requires_sandbox_token",
      );
    }
  });

  it("rejects production tokens even if live_mode false or absent", () => {
    for (const mode of [true, false, undefined]) {
      expect(() => assertMpOAuthTokenMode("test", mode, LIVE_TOKEN)).toThrow(
        "oauth_test_environment_requires_sandbox_token",
      );
    }
  });

  it("rejects tokens without a TEST prefix in test", () => {
    for (const token of [undefined, null, "", "invalid", "TEST", "OTHER-not-a-token"]) {
      expect(() => assertMpOAuthTokenMode("test", false, token)).toThrow(
        "oauth_test_environment_requires_sandbox_token",
      );
    }
  });

  it("rejects sandbox and indeterminate tokens in production", () => {
    expect(() => assertMpOAuthTokenMode("production", true, LIVE_TOKEN)).not.toThrow();
    for (const mode of [false, null, undefined]) {
      expect(() => assertMpOAuthTokenMode("production", mode, LIVE_TOKEN)).toThrow(
        "oauth_production_environment_requires_live_token",
      );
    }
    expect(() => assertMpOAuthTokenMode("production", true, TEST_TOKEN)).toThrow(
      "oauth_production_environment_requires_live_token",
    );
  });
});
