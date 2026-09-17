import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260917150526_harden_payments_api_write.sql"),
  "utf8",
).trim();

describe("payments API write hardening migration", () => {
  it("removes every API write and administrative privilege while retaining SELECT", () => {
    expect(migration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain("GRANT SELECT ON TABLE public.payments TO anon, authenticated;");
  });

  it("removes only the three write policies", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Owners insert own payments" ON public.payments;',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Admins update payments" ON public.payments;',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Admins delete payments" ON public.payments;',
    );
  });

  it("does not modify trusted writers, SELECT policies, or table structure", () => {
    expect(migration).toBe(
      [
        "REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated;",
        "GRANT SELECT ON TABLE public.payments TO anon, authenticated;",
        "",
        'DROP POLICY IF EXISTS "Owners insert own payments" ON public.payments;',
        'DROP POLICY IF EXISTS "Admins update payments" ON public.payments;',
        'DROP POLICY IF EXISTS "Admins delete payments" ON public.payments;',
      ].join("\n"),
    );
  });
});
