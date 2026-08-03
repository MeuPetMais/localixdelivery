import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "supabase/migrations/20260803162000_driver_availability_queue.sql";

describe("driver availability queue integration", () => {
  it("turning online updates presence and enqueues in one database function", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.driver_set_availability");
    expect(sql).toContain("SET online = true");
    expect(sql).toContain("v_queue_id := public.queue_enqueue");
    expect(sql).toContain("'in_queue', v_queue.status = 'AGUARDANDO'");
    expect(sql).toContain("'position', v_queue.position");
    expect(sql).toContain("'entered_at', v_queue.entered_at");
  });

  it("does not catch queue_enqueue failures after setting online", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("v_queue_id := public.queue_enqueue");
    expect(sql).not.toMatch(/EXCEPTION\s+WHEN\s+OTHERS/i);
  });

  it("turning offline removes the queue entry and then marks the driver offline", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("PERFORM public.queue_remove");
    expect(sql).toContain("SET online = false");
    expect(sql).toContain("'queue_action', 'REMOVE'");
    expect(sql).not.toContain("PERFORM public.queue_dequeue(v_driver.restaurant_id, v_driver.id)");
  });

  it("blocks offline while an assignment is active", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("a.status IN ('ATRIBUIDO', 'COLETANDO', 'EM_ROTA')");
    expect(sql).toContain("Finalize ou redistribua a entrega antes de ficar offline.");
  });

  it("keeps active delivery, pause and return out of premature queue entry", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("'queue_action', 'ACTIVE_ASSIGNMENT'");
    expect(sql).toContain("v_queue.status = 'RETORNANDO' OR v_has_return");
    expect(sql).toContain("'queue_action', 'RETURNING'");
    expect(sql).toContain("'queue_action', 'PAUSED'");
  });

  it("keeps automatic assignment coupled to queue enqueue", () => {
    const sql = readFileSync("supabase/migrations/20260803124500_auto_assign_delivery_from_queue.sql", "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.queue_enqueue");
    expect(sql).toContain("delivery_auto_assign_pending_for_restaurant");
    expect(sql).toContain("'QUEUE_AVAILABLE'");
  });

  it("the driver app uses availability instead of raw presence and keeps queue entry as recovery", () => {
    const route = readFileSync("src/routes/motoboy.tsx", "utf8");

    expect(route).toContain("setDriverAvailability");
    expect(route).toContain("availabilityMut.mutate(!driver.online)");
    expect(route).not.toContain("setMyPresence");
    expect(route).toContain("showQueueRecovery");
    expect(route).toContain("Reentrar na fila");
  });
});
