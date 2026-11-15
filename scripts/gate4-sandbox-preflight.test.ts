import { describe, expect, it } from "vitest";
import { validateFinancialSandboxEnvironment } from "./gate4-sandbox-preflight.mjs";

const isolated = {
  SUPABASE_PROJECT_ID: "abcdefghijklmnopqrst",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  VITE_SUPABASE_PROJECT_ID: "abcdefghijklmnopqrst",
  VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  MP_ENVIRONMENT: "sandbox",
  MP_PUBLIC_KEY_TEST: "TEST-synthetic-placeholder",
  MP_ACCESS_TOKEN_TEST: "TEST-synthetic-placeholder",
  MP_WEBHOOK_RETRY_CUTOVER: "2026-11-13T00:00:00Z",
  MP_RETRY_AUTOMATION_ENABLED: "false",
};

describe("Gate4 H1 isolated sandbox preflight (no gateway calls)", () => {
  it("passes synthetic isolated environment markers only", () => {
    expect(validateFinancialSandboxEnvironment(isolated)).toEqual({ ok: true, errors: [] });
  });

  it.each(["mvkfrwxgneqzvoabkaws", "dnotmvbhuqujvqdtgzav"])(
    "blocks production/shared staging %s",
    (id) => {
      const env = { ...isolated, SUPABASE_PROJECT_ID: id };
      expect(validateFinancialSandboxEnvironment(env).ok).toBe(false);
    },
  );

  it("rejects a frontend pointing to another backend, even if the backend is isolated", () => {
    expect(
      validateFinancialSandboxEnvironment({
        ...isolated,
        VITE_SUPABASE_PROJECT_ID: "zzzzzzzzzzzzzzzzzzzz",
      }).errors,
    ).toContain("frontend_backend_project_mismatch");
  });

  it("blocks missing test credentials or mismatched mode", () => {
    const result = validateFinancialSandboxEnvironment({
      ...isolated,
      MP_ENVIRONMENT: "production",
      MP_ACCESS_TOKEN_TEST: "APP_USR-synthetic",
    });
    expect(result.errors).toContain("mp_test_mode_missing");
    expect(result.errors).toContain("mp_access_token_not_test");
  });

  it("blocks production functions fallback, scheduler and missing retry cutover", () => {
    const result = validateFinancialSandboxEnvironment({
      ...isolated,
      PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://production.example.invalid",
      MP_RETRY_AUTOMATION_ENABLED: "true",
      MP_WEBHOOK_RETRY_CUTOVER: "",
    });
    expect(result.errors).toContain("production_functions_fallback_present");
    expect(result.errors).toContain("scheduler_must_remain_off");
    expect(result.errors).toContain("retry_cutover_unconfigured");
  });
});
