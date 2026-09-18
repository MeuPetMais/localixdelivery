import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260918220000_harden_support_internal_rpcs.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Gate D support internal RPC hardening", () => {
  it("moves internal support mutation/helpers to service_role only", () => {
    for (const fn of [
      "enqueue_support_notification",
      "notify_support_recipients",
      "enqueue_support_sla_notifications",
      "run_support_sla_notifications_job",
      "support_internal_recipient_ids",
    ]) {
      expect(migration).toContain(`public.${fn}`);
    }
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("adds DB-side ownership validation to queue_next_driver", () => {
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("r.owner_id = auth.uid()");
    expect(migration).toContain("public.has_role(auth.uid(), 'admin'::public.app_role)");
    expect(migration).toContain("RAISE EXCEPTION 'Forbidden'");
  });

  it("keeps queue_next_driver authenticated and removes anon", () => {
    expect(migration).toContain("public.queue_next_driver(uuid)");
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain("TO authenticated, service_role");
  });
});
