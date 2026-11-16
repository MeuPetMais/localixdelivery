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

  it("validates TEST payer email syntax without requiring an unavailable dashboard secret", () => {
    const payerRequired = source.indexOf('error: "payer_email_required"');
    const payerDomainGuard = source.indexOf("sandbox_test_payer_email_required");
    const paymentUpsert = source.indexOf('.upsert(', source.indexOf('"order_payment"', payerDomainGuard));
    const mpPost = source.indexOf("mp = await createPixPayment(");

    expect(payerRequired).toBeGreaterThanOrEqual(0);
    expect(payerDomainGuard).toBeGreaterThan(payerRequired);
    expect(paymentUpsert).toBeGreaterThan(payerDomainGuard);
    expect(mpPost).toBeGreaterThan(paymentUpsert);
    expect(source).not.toContain("MP_TEST_BUYER_EMAIL");
    expect(source).not.toContain("sandbox_test_buyer_not_configured");
    expect(source).not.toContain("sandbox_test_buyer_mismatch");
  });

  it("keeps sandbox order authorization limited to the fixed synthetic identity", () => {
    expect(sandboxSection).toContain("restaurant.owner_id !== sandboxCallerId");
    expect(sandboxSection).toContain('order.customer_name !== "GATE4 SANDBOX PAYMENT"');
    expect(sandboxSection).toContain("sandbox_amount_out_of_bounds");
  });
});
