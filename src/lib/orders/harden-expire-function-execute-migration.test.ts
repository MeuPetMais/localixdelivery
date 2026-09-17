import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260917135923_harden_expire_function_execute.sql"),
  "utf8",
).trim();

describe("expire function EXECUTE hardening migration", () => {
  it("revokes only the API-facing execute privileges", () => {
    expect(migration).toBe(
      [
        "REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_orders() FROM PUBLIC;",
        "REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_orders() FROM anon;",
        "REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_orders() FROM authenticated;",
        "REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_orders() FROM service_role;",
      ].join("\n"),
    );
  });

  it("does not recreate the function or change postgres and transition grants", () => {
    expect(migration).not.toMatch(/CREATE|ALTER|GRANT|order_apply_transition|postgres/i);
  });
});
