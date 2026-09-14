import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260914132000_harden_orders_write_access.sql",
);

const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.replace(/\s+/g, " ").trim().toLowerCase();

const orderServiceSource = readFileSync(
  resolve(process.cwd(), "src/lib/checkout/OrderService.ts"),
  "utf8",
);
const pricingEngineSource = readFileSync(
  resolve(process.cwd(), "src/lib/payments/PricingEngine.ts"),
  "utf8",
);
const paymentIntentSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/mp-payment-intent/index.ts"),
  "utf8",
);
const orderPaymentSource = readFileSync(
  resolve(process.cwd(), "src/lib/payments/orderPayment.server.ts"),
  "utf8",
);

describe("orders RLS hardening migration", () => {
  it("drops direct public order write policies", () => {
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;',
    );
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Owners delete their orders" ON public.orders;',
    );
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Owners update their orders" ON public.orders;',
    );
  });

  it("revokes direct order writes from anon and authenticated", () => {
    for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
      expect(migrationSql).toContain(`REVOKE ${privilege} ON public.orders FROM anon;`);
      expect(migrationSql).toContain(`REVOKE ${privilege} ON public.orders FROM authenticated;`);
    }
  });

  it("revokes only anon execute on order_apply_transition and preserves required callers", () => {
    const signature = "public.order_apply_transition(uuid, text, text, text, text, uuid, jsonb)";

    expect(normalizedSql).toContain(`revoke execute on function ${signature} from anon;`);
    expect(normalizedSql).toContain(`grant execute on function ${signature} to authenticated;`);
    expect(normalizedSql).toContain(`grant execute on function ${signature} to service_role;`);
    expect(normalizedSql).not.toContain(
      `revoke execute on function ${signature} from authenticated`,
    );
    expect(normalizedSql).not.toContain(
      `revoke execute on function ${signature} from service_role`,
    );
  });

  it("does not alter SELECT policies or recreate write policies", () => {
    expect(normalizedSql).not.toContain("customers view own orders");
    expect(normalizedSql).not.toContain("owners view their orders");
    expect(normalizedSql).not.toContain("create policy");
    expect(normalizedSql).not.toContain("grant select on public.orders");
    expect(normalizedSql).not.toContain("revoke select on public.orders");
  });

  it("does not alter checkout, pricing, order service, or payment code", () => {
    expect(orderServiceSource).toContain("export const createCheckoutOrder");
    expect(orderServiceSource).toContain('.from("orders")');
    expect(pricingEngineSource).toContain("export function computePricing");
    expect(paymentIntentSource).toContain("mp-payment-intent");
    expect(orderPaymentSource).toContain("registerPendingOrderPayment");

    expect(migrationSql).not.toContain("PricingEngine");
    expect(migrationSql).not.toContain("order_pricing_snapshot");
    expect(migrationSql).not.toContain("order_payment");
    expect(migrationSql).not.toContain("payments");
  });
});
