import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260918214500_harden_loyalty_security_definer_surface.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Gate D loyalty SECURITY DEFINER hardening", () => {
  it("moves loyalty mutation RPCs to service_role only", () => {
    for (const fn of [
      "loyalty_apply",
      "loyalty_reserve",
      "loyalty_commit_reserve",
      "loyalty_rollback_reserve",
      "loyalty_expire_points",
    ]) {
      expect(migration).toContain(`public.${fn}`);
    }
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });
});
