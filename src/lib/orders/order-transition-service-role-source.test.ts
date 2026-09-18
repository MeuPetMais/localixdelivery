import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260918154500_fix_order_transition_service_role_claims.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("order_apply_transition service-role detection", () => {
  it("uses Supabase auth.role() instead of the legacy single-claim GUC", () => {
    expect(migration).toContain("v_is_service_role boolean := auth.role() = 'service_role';");
    expect(migration).not.toContain(
      "current_setting('request.jwt.claim.role', true), '') = 'service_role'",
    );
  });

  it("preserves webhook/system actor rules and financial transition guards", () => {
    expect(migration).toContain("_actor_type = 'webhook'");
    expect(migration).toContain("_actor_type = 'system'");
    expect(migration).toContain("'ONLINE_PAYMENT_REFUND_REQUIRED'");
    expect(migration).toContain("'PAYMENT_APPROVAL_REQUIRED'");
    expect(migration).toContain("'chargeback'");
    expect(migration).toContain("'reembolsado'");
  });

  it("does not change grants", () => {
    expect(migration).not.toMatch(/\bGRANT\b/i);
    expect(migration).not.toMatch(/\bREVOKE\b/i);
  });
});
