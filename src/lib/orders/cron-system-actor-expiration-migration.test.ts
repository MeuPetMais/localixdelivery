import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8").replace(/\r\n/g, "\n");

const baseline = readMigration("20260916160615_payment_expiration_webhook_race_guard.sql");
const migration = readMigration("20260916204420_cron_system_actor_expiration.sql");

function functionSql(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end + 3);
}

function replaceOnce(source: string, before: string, after: string): string {
  expect(source.split(before)).toHaveLength(2);
  return source.replace(before, after);
}

const cronPredicate = `  v_is_internal_expire_cron :=
    session_user = 'postgres'
    AND COALESCE(current_setting('request.jwt.claim.role', true), '') = ''
    AND COALESCE(current_setting('request.jwt.claim.sub', true), '') = ''
    AND v_auth_uid IS NULL
    AND _actor_type = 'system'
    AND _expected_from = 'aguardando_pagamento'
    AND v_current = 'aguardando_pagamento'
    AND _next_status = 'falha_pagamento'
    AND _reason = 'auto_expire:15min';

`;

describe("cron system actor expiration migration", () => {
  it("changes expire only to inspect the transition result and count success", () => {
    let expected = functionSql(baseline, "expire_pending_payment_orders");
    expected = replaceOnce(
      expected,
      "  v_count integer := 0;\n",
      "  v_count integer := 0;\n  v_result jsonb;\n",
    );
    expected = replaceOnce(
      expected,
      "    PERFORM public.order_apply_transition(",
      "    v_result := public.order_apply_transition(",
    );
    expected = replaceOnce(
      expected,
      "    v_count := v_count + 1;",
      `    IF COALESCE((v_result->>'ok')::boolean, false) THEN
      v_count := v_count + 1;
    ELSE
      RAISE WARNING 'expire_pending_payment_orders: order_id=%, reason=%',
        r.id, COALESCE(v_result->>'reason', 'UNKNOWN');
    END IF;`,
    );

    expect(functionSql(migration, "expire_pending_payment_orders")).toBe(expected);
    expect(expected).toContain("FOR UPDATE SKIP LOCKED");
    expect(expected).toContain("interval '15 minutes'");
    expect(expected).toContain("LIMIT 500");
    expect(expected).toContain("FROM public.order_payment op");
    expect(expected).toContain("FROM public.payments p");
  });

  it("adds only the narrow native cron authorization to the state machine", () => {
    let expected = functionSql(baseline, "order_apply_transition");
    expected = replaceOnce(
      expected,
      "  v_auth_uid uuid := auth.uid();\n",
      "  v_auth_uid uuid := auth.uid();\n  v_is_internal_expire_cron boolean := false;\n",
    );
    expected = replaceOnce(
      expected,
      "  IF v_current = 'falha_pagamento' AND _next_status = 'pago' THEN",
      `${cronPredicate}  IF v_current = 'falha_pagamento' AND _next_status = 'pago' THEN`,
    );
    expected = replaceOnce(
      expected,
      "  IF NOT v_is_service_role THEN",
      "  IF NOT v_is_service_role AND NOT v_is_internal_expire_cron THEN",
    );

    expect(functionSql(migration, "order_apply_transition")).toBe(expected);
    expect(expected).toContain("'ONLINE_PAYMENT_REFUND_REQUIRED'");
    expect(expected).toContain("'PAYMENT_APPROVAL_REQUIRED'");
    expect(expected).toContain("(_actor_type = 'webhook' AND _next_status IN (");
    expect(expected).not.toContain("current_user = 'postgres'");
    expect(expected).not.toContain("current_role = 'postgres'");
  });

  it("leaves signatures, SECURITY DEFINER, search paths and grants unchanged", () => {
    for (const name of ["expire_pending_payment_orders", "order_apply_transition"]) {
      const current = functionSql(migration, name);
      const previous = functionSql(baseline, name);
      expect(current.slice(0, current.indexOf("AS $$"))).toBe(
        previous.slice(0, previous.indexOf("AS $$")),
      );
      expect(current).toContain("SECURITY DEFINER");
    }
    expect(migration).not.toMatch(/\b(?:GRANT|REVOKE|ALTER\s+FUNCTION)\b/i);
  });
});
