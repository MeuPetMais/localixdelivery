import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260918211500_harden_delivery_security_definer_surface.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Gate D delivery SECURITY DEFINER hardening", () => {
  it("moves internal delivery mutation RPCs to service_role only", () => {
    for (const fn of [
      "delivery_auto_assign_order",
      "delivery_auto_assign_pending_for_restaurant",
      "driver_set_availability",
      "queue_audit_insert",
      "queue_reposition_after",
      "queue_assert_driver_can_wait",
      "queue_enqueue",
      "queue_dequeue",
      "queue_start_return",
      "queue_return",
      "queue_remove",
    ]) {
      expect(migration).toContain(`public.${fn}`);
    }
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("keeps only authenticated access for identity-bound public RPCs", () => {
    expect(migration).toContain("public.driver_switch_restaurant_context(uuid)");
    expect(migration).toContain("public.upsert_driver_operational_location(");
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain("TO authenticated, service_role");
  });

  it("hardens assignment transitions with DB-side actor and transition validation", () => {
    expect(migration).toContain("v_is_service_role boolean := auth.role() = 'service_role'");
    expect(migration).toContain("'INVALID_TRANSITION'");
    expect(migration).toContain("'ACTOR_NOT_AUTHORIZED'");
    expect(migration).toContain("r.owner_id = v_auth_uid");
    expect(migration).toContain("d.owner_id = v_auth_uid");
  });
});
