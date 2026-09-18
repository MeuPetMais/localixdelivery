import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260918213000_harden_trigger_function_execute.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Gate D trigger function EXECUTE hardening", () => {
  it("revokes direct API execution from trigger-only SECURITY DEFINER functions", () => {
    for (const fn of [
      "enforce_driver_earning_from_order_snapshot",
      "enforce_partner_email_only",
      "enforce_role_email_only",
      "tg_link_reused_driver_identity",
      "tg_orders_loyalty_status",
      "tg_reuse_existing_driver_identity",
      "tg_support_message_notifications",
      "tg_support_ticket_admin_timestamps",
      "tg_support_ticket_defaults",
      "tg_support_ticket_notifications",
      "tg_support_ticket_reopen_counter",
      "tg_sync_driver_restaurant_membership",
    ]) {
      expect(migration).toContain(`public.${fn}()`);
    }
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("keeps queue_next_driver authenticated but removes anon", () => {
    expect(migration).toContain("public.queue_next_driver(uuid)");
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain("TO authenticated, service_role");
  });
});
