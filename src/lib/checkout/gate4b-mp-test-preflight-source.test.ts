import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../supabase/functions/mp-payment-intent/index.ts", import.meta.url),
  "utf8",
);
const sandboxSection = source.slice(
  source.indexOf('if (environment === "test") {', source.indexOf("const sandboxCallerId")),
);

describe("Gate 4B — MP test-payment preflight", () => {
  it("requires the test fixture to remain closed but public-menu active", () => {
    expect(source).toContain("restaurant.active !== true ||");
    expect(source).toContain("restaurant.is_open !== false ||");
    expect(source).not.toContain("restaurant.active !== false ||");
  });

  it("rejects unconfigured or mismatched TEST buyers before any PIX persistence or request", () => {
    const buyerConfig = source.indexOf('Deno.env.get("MP_TEST_BUYER_EMAIL")');
    const unconfigured = source.indexOf("sandbox_test_buyer_not_configured");
    const mismatch = source.indexOf("sandbox_test_buyer_mismatch");
    const paymentUpsert = source.indexOf('"order_payment")\n        .upsert(', buyerConfig);
    const mpPost = source.indexOf("mp = await createPixPayment(", buyerConfig);

    expect(buyerConfig).toBeGreaterThan(0);
    expect(unconfigured).toBeGreaterThan(buyerConfig);
    expect(mismatch).toBeGreaterThan(unconfigured);
    expect(paymentUpsert).toBeGreaterThan(mismatch);
    expect(mpPost).toBeGreaterThan(paymentUpsert);
    expect(source).toContain("configuredBuyerEmail");
    expect(source).toContain("payerEmail !== configuredBuyerEmail");
  });

  it("keeps sandbox order authorization limited to the fixed synthetic identity", () => {
    expect(sandboxSection).toContain("restaurant.owner_id !== sandboxCallerId");
    expect(sandboxSection).toContain('order.customer_name !== "GATE4 SANDBOX PAYMENT"');
    expect(sandboxSection).toContain("sandbox_amount_out_of_bounds");
  });
});
