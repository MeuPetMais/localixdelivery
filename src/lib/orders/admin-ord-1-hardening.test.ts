import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS, ORDER_STATES } from "./OrderStateMachine";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260825120000_admin_ord_1_secure_order_transitions.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const transitionFnSource = readFileSync(
  resolve(process.cwd(), "src/lib/orders/orders.functions.ts"),
  "utf8",
);

describe("ADMIN-ORD-1 order transition hardening", () => {
  it("mirrors every OrderStateMachine transition in order_apply_transition", () => {
    for (const from of ORDER_STATES) {
      const allowed = ALLOWED_TRANSITIONS[from];
      if (allowed.length === 0) {
        expect(migrationSql).not.toContain(`v_current = '${from}' AND _next_status IN`);
        continue;
      }

      expect(migrationSql).toContain(
        `(v_current = '${from}' AND _next_status IN (${allowed.map((to) => `'${to}'`).join(", ")}))`,
      );
    }
  });

  it("returns controlled INVALID_TRANSITION details before updating orders", () => {
    const invalidTransitionIndex = migrationSql.indexOf("'INVALID_TRANSITION'");
    const updateIndex = migrationSql.indexOf("UPDATE public.orders");

    expect(invalidTransitionIndex).toBeGreaterThan(0);
    expect(invalidTransitionIndex).toBeLessThan(updateIndex);
    expect(migrationSql).toContain("'current', v_current");
    expect(migrationSql).toContain("'requested', _next_status");
  });

  it("keeps CAS and delivery assignment guards inside the atomic RPC", () => {
    expect(migrationSql).toContain("FOR UPDATE");
    expect(migrationSql).toContain("'STATE_MISMATCH'");
    expect(migrationSql).toContain("'DELIVERY_ASSIGNMENT_REQUIRED'");
    expect(migrationSql).toContain("_next_status = 'saiu_para_entrega'");
    expect(migrationSql).toContain("COALESCE(v_assignment_status, '') <> 'EM_ROTA'");
    expect(migrationSql).toContain("_next_status = 'entregue'");
    expect(migrationSql).toContain("COALESCE(v_assignment_status, '') <> 'ENTREGUE'");
  });

  it("rejects actor spoofing for public API callers while preserving service_role paths", () => {
    expect(migrationSql).toContain("v_is_service_role boolean");
    expect(migrationSql).toContain("request.jwt.claim.role");
    expect(migrationSql).toContain("_actor_type IN ('system', 'webhook')");
    expect(migrationSql).toContain("_actor_type = 'admin' AND NOT public.has_role");
    expect(migrationSql).toContain("_actor_type = 'restaurant'");
    expect(migrationSql).toContain("_actor_type = 'customer'");
    expect(migrationSql).toContain("_actor_type = 'courier'");
    expect(migrationSql).toContain("'FORBIDDEN_ACTOR'");
    expect(migrationSql).toContain("'ACTOR_NOT_AUTHORIZED'");
  });

  it("removes broad direct UPDATE on orders from anon/authenticated and does not regrant status", () => {
    expect(migrationSql).toContain("REVOKE UPDATE ON public.orders FROM anon, authenticated");
    expect(migrationSql).toContain("REVOKE UPDATE (");
    expect(migrationSql).toContain("status,");
    expect(migrationSql).not.toMatch(/GRANT\s+UPDATE\s*\([^)]*\bstatus\b/i);
    expect(migrationSql).not.toMatch(/GRANT\s+UPDATE\s+ON\s+public\.orders\s+TO\s+(anon|authenticated)/i);
    expect(migrationSql).toContain("GRANT ALL ON public.orders TO service_role");
  });

  it("keeps RPC execute compatibility for existing callers in this batch", () => {
    expect(migrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.order_apply_transition(uuid, text, text, text, text, uuid, jsonb)",
    );
    expect(migrationSql).toContain("TO anon, authenticated, service_role");
  });

  it("makes transitionOrderStatus use only the atomic RPC path", () => {
    expect(transitionFnSource).toContain("applyAtomic");
    expect(transitionFnSource).toContain('rpc("order_apply_transition"');
    expect(transitionFnSource).not.toContain(".update({ status: next })");
    expect(transitionFnSource).not.toContain(".from(\"order_status_history\")");
  });
});
