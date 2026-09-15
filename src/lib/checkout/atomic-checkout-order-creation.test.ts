import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260914174138_atomic_checkout_order_creation.sql",
);

const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.replace(/\s+/g, " ").trim().toLowerCase();
const stagingTestSql = readFileSync(
  resolve(process.cwd(), "scripts/sql/atomic_checkout_staging_test.sql"),
  "utf8",
);
const normalizedStagingTestSql = stagingTestSql.replace(/\s+/g, " ").trim().toLowerCase();
const orderServiceSource = readFileSync(
  resolve(process.cwd(), "src/lib/checkout/OrderService.ts"),
  "utf8",
);
const routeSource = readFileSync(resolve(process.cwd(), "src/routes/$slug.index.tsx"), "utf8");

function extractFunctionSignatureTypes(sql: string, keyword: "FUNCTION" | "ON FUNCTION") {
  const start = sql.toUpperCase().indexOf(`${keyword} PUBLIC.CREATE_ORDER_WITH_SNAPSHOT_PAYMENT(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const argsStart = sql.indexOf("(", start);
  let depth = 0;
  for (let index = argsStart; index < sql.length; index += 1) {
    const char = sql[index];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0) {
      return sql
        .slice(argsStart + 1, index)
        .split(",")
        .map((part) => part.trim().replace(/\s+DEFAULT\s+NULL$/i, ""))
        .map((part) => part.split(/\s+/).at(-1)?.toLowerCase())
        .filter(Boolean);
    }
  }
  throw new Error("signature not closed");
}

const functionParameterTypes = extractFunctionSignatureTypes(migrationSql, "FUNCTION");
const grantSignatureTypes = extractFunctionSignatureTypes(
  migrationSql.slice(migrationSql.toUpperCase().lastIndexOf("GRANT EXECUTE ON FUNCTION")),
  "ON FUNCTION",
);

const checkoutCreatePayload = routeSource.slice(
  routeSource.indexOf("const res = await create({"),
  routeSource.indexOf("});", routeSource.indexOf("const res = await create({")) + 3,
);

describe("atomic checkout order creation", () => {
  it("uses a dedicated idempotency table with minimal grants", () => {
    expect(normalizedSql).toContain("create table if not exists public.checkout_order_idempotency");
    expect(normalizedSql).toContain("idempotency_key text primary key");
    expect(normalizedSql).toContain("payload_hash text not null");
    expect(normalizedSql).toContain("order_id uuid not null references public.orders(id)");
    expect(normalizedSql).toContain(
      "alter table public.checkout_order_idempotency enable row level security",
    );
    expect(normalizedSql).toContain(
      "revoke all on public.checkout_order_idempotency from authenticated",
    );
    expect(normalizedSql).toContain(
      "grant select, insert, update, delete on public.checkout_order_idempotency to service_role",
    );
    expect(normalizedSql).not.toContain("add column if not exists service_fee_payer");
    expect(normalizedSql).not.toContain("add column if not exists realized_platform_revenue");
  });

  it("creates a security invoker RPC callable only by service_role", () => {
    expect(normalizedSql).toContain(
      "create or replace function public.create_order_with_snapshot_payment",
    );
    expect(normalizedSql).toContain("security invoker");
    expect(normalizedSql).toContain("set search_path = public");
    expect(normalizedSql).toContain(
      "revoke all on function public.create_order_with_snapshot_payment",
    );
    expect(normalizedSql).toContain(
      "revoke execute on function public.create_order_with_snapshot_payment",
    );
    expect(normalizedSql).toContain("from anon");
    expect(normalizedSql).toContain("from authenticated");
    expect(normalizedSql).toContain("to service_role");
    expect(normalizedSql).not.toContain("security definer");
  });

  it("keeps RPC grant signature identical to declared parameters", () => {
    expect(grantSignatureTypes).toEqual(functionParameterTypes);
    expect(functionParameterTypes).toHaveLength(31);
    expect(functionParameterTypes).toEqual([
      "text",
      "text",
      "uuid",
      "uuid",
      "text",
      "text",
      "text",
      "text",
      "jsonb",
      "numeric",
      "numeric",
      "numeric",
      "text",
      "numeric",
      "numeric",
      "numeric",
      "text",
      "numeric",
      "numeric",
      "numeric",
      "numeric",
      "numeric",
      "numeric",
      "numeric",
      "numeric",
      "numeric",
      "text",
      "text",
      "text",
      "text",
      "text",
    ]);
  });

  it("serializes retries by key and fails closed on divergent payload hash", () => {
    expect(normalizedSql).toContain("pg_advisory_xact_lock(hashtextextended(_idempotency_key, 0))");
    expect(normalizedSql).toContain("for update");
    expect(normalizedSql).toContain("if v_existing.payload_hash <> _payload_hash then");
    expect(normalizedSql).toContain("idempotency_conflict");
    expect(normalizedSql).toContain("select o.id, o.order_number, true");
    expect(normalizedSql).toContain("return query select v_order_id, v_order_number, false");
  });

  it("persists order, snapshot and payment inside the same RPC body", () => {
    expect(normalizedSql).toContain("insert into public.orders");
    expect(normalizedSql).toContain("insert into public.order_pricing_snapshot");
    expect(normalizedSql).toContain("insert into public.order_payment");
    expect(normalizedSql).toContain("insert into public.checkout_order_idempotency");
    expect(normalizedSql).toContain("_payment_status");
    expect(normalizedSql).toContain("coalesce(_payment_external_reference, v_order_id::text)");
  });

  it("does not expose permanent runtime failure hooks", () => {
    expect(normalizedSql).not.toContain("_test_fail_at");
    expect(normalizedSql).not.toContain("app.localix_atomic_checkout_test");
    expect(normalizedSql).not.toContain("test_failure_disabled");
    expect(normalizedSql).not.toContain("test_failure_after_order");
    expect(normalizedSql).not.toContain("test_failure_after_snapshot");
  });

  it("keeps destructive atomicity probes in a staging-only rollback script", () => {
    expect(normalizedStagingTestSql).toContain("localix_staging_atomic_checkout_test");
    expect(normalizedStagingTestSql).toContain("begin;");
    expect(normalizedStagingTestSql).toContain("rollback;");
    expect(normalizedStagingTestSql).toContain(
      "create trigger localix_atomic_checkout_raise_after_order_for_test",
    );
    expect(normalizedStagingTestSql).toContain(
      "create trigger localix_atomic_checkout_raise_after_snapshot_for_test",
    );
    expect(normalizedStagingTestSql).toContain("localix_atomic_checkout_after_order");
    expect(normalizedStagingTestSql).toContain("localix_atomic_checkout_after_snapshot");
    expect(normalizedStagingTestSql).not.toContain("_test_fail_at");
    expect(normalizedStagingTestSql).not.toContain("app.localix_atomic_checkout_test");
  });

  it("OrderService computes authoritative hash server-side and calls only the RPC for writes", () => {
    expect(orderServiceSource).toContain("buildCheckoutCreationPayloadHash");
    expect(orderServiceSource).toContain(".rpc(");
    expect(orderServiceSource).toContain('"create_order_with_snapshot_payment"');
    expect(orderServiceSource).toContain("_snapshot_customer_total: pricing.customerTotal");
    expect(orderServiceSource).toContain("_payment_status: paymentDecision.paymentRecordStatus");
    expect(orderServiceSource).not.toContain('.from("order_pricing_snapshot").insert');
    expect(orderServiceSource).not.toContain("registerPendingOrderPayment");
  });

  it("public checkout sends only an attempt idempotency key, not authoritative finance", () => {
    expect(routeSource).toContain("checkoutAttemptRef");
    expect(routeSource).toContain("checkoutIdempotencyKey");
    expect(routeSource).toContain("crypto.randomUUID()");
    expect(checkoutCreatePayload).not.toContain("platformFee:");
    expect(checkoutCreatePayload).not.toContain("customerTotal:");
    expect(checkoutCreatePayload).not.toContain("restaurantNet:");
  });

  it("clears the frontend idempotency key only after an order is accepted locally", () => {
    const firstClearIndex = routeSource.indexOf("checkoutAttemptRef.current = null");
    const rpcReturnIndex = routeSource.indexOf("const res = await create({");
    const firstOrderAcceptedIndex = routeSource.indexOf("onCreated(res.orderId)");

    expect(firstClearIndex).toBeGreaterThan(rpcReturnIndex);
    expect(firstClearIndex).toBeLessThan(firstOrderAcceptedIndex);
    expect(routeSource.slice(rpcReturnIndex, firstClearIndex)).not.toContain(
      "checkoutAttemptRef.current = null",
    );
  });
});
