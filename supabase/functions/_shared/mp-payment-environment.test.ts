import { describe, expect, it } from "vitest";
import {
  assertMpSellerTokenMode,
  assertMpExpectedTestSeller,
  resolveMpPaymentWebhookUrl,
} from "./mp-payment-environment";

const SANDBOX = "https://gvozcqyjhogmvebrwzap.supabase.co";
const PRODUCTION = "https://mvkfrwxgneqzvoabkaws.supabase.co";

describe("Gate 4 payment intent environment isolation", () => {
  it("routes TEST notifications only to the isolated project", () => {
    expect(resolveMpPaymentWebhookUrl(SANDBOX, "test")).toBe(SANDBOX + "/functions/v1/mp-webhook");
  });

  it("rejects production origin in TEST and missing configuration", () => {
    expect(() => resolveMpPaymentWebhookUrl(PRODUCTION, "test")).toThrow(
      "mp_payment_test_must_not_use_production",
    );
    expect(() => resolveMpPaymentWebhookUrl(undefined, "test")).toThrow();
    expect(() => resolveMpPaymentWebhookUrl(SANDBOX, undefined)).toThrow();
    expect(() => resolveMpPaymentWebhookUrl(SANDBOX, "staging")).toThrow();
    expect(() => resolveMpPaymentWebhookUrl("http://localhost:54321", "test")).toThrow();
    expect(() => resolveMpPaymentWebhookUrl("https://evil.example", "test")).toThrow();
  });

  it("accepts only a TEST token from a sandbox seller", () => {
    expect(() => assertMpSellerTokenMode("test", false, "TEST-synthetic")).not.toThrow();
    expect(() => assertMpSellerTokenMode("test", true, "TEST-synthetic")).toThrow();
    expect(() => assertMpSellerTokenMode("test", false, "APP_USR-synthetic")).toThrow();
    expect(() => assertMpSellerTokenMode("test", undefined, "TEST-synthetic")).toThrow();
  });

  it("preserves a strict production contract", () => {
    expect(() => assertMpSellerTokenMode("production", true, "APP_USR-synthetic")).not.toThrow();
    expect(() => assertMpSellerTokenMode("production", false, "APP_USR-synthetic")).toThrow();
    expect(() => assertMpSellerTokenMode("production", true, "TEST-synthetic")).toThrow();
    expect(resolveMpPaymentWebhookUrl(PRODUCTION, "production")).toBe(
      PRODUCTION + "/functions/v1/mp-webhook",
    );
  });
  it("requires a named test seller account instead of the real app owner", () => {
    expect(() => assertMpExpectedTestSeller("test", "385001111", "385001111")).not.toThrow();
    expect(() => assertMpExpectedTestSeller("test", "455773879", "385001111")).toThrow(
      "mp_test_seller_identity_not_verified",
    );
    expect(() => assertMpExpectedTestSeller("test", "455773879", undefined)).toThrow(
      "mp_test_seller_identity_not_verified",
    );
    expect(() => assertMpExpectedTestSeller("production", "455773879", undefined)).not.toThrow();
  });
});
