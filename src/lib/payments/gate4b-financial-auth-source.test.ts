import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../supabase/functions/mp-payment-intent/index.ts", import.meta.url),
  "utf8",
);

describe("Gate 4B payment handler hardening — source integration", () => {
  it("validates JWT with Supabase before any privileged order access", () => {
    const auth = source.indexOf("await sb.auth.getUser(accessJwt)");
    const readOrder = source.indexOf('.from("orders")');
    expect(auth).toBeGreaterThan(0);
    expect(readOrder).toBeGreaterThan(auth);
    expect(source).toContain("caller.user.is_anonymous");
  });

  it("requires object authorization before seller OAuth or MP requests", () => {
    const guard = source.indexOf("isAuthorizedPaymentAction({");
    const oauth = source.indexOf("const token = await getAccessToken(sb, order.restaurant_id)");
    const mpPost = source.indexOf('fetch("https://api.mercadopago.com/v1/payments"');
    expect(guard).toBeGreaterThan(0);
    expect(oauth).toBeGreaterThan(guard);
    expect(mpPost).toBeGreaterThan(0);
    expect(source).toContain('error: "payment_action_forbidden"');
  });

  it("uses server-derived restaurant ownership and order customer", () => {
    expect(source).toContain('.select("id, owner_id")');
    expect(source).toContain("ownerId: restaurant.owner_id");
    expect(source).toContain("customerId: order.customer_id");
    expect(source).not.toContain("ownerId: payload.");
    expect(source).not.toContain("customerId: payload.");
  });

  it("derives MP status from reversal-aware policy, not a phantom approval", () => {
    expect(source).toContain("mapMpStatus as mapStatus");
    expect(source).not.toContain('case "charged_back":\n      return "APPROVED"');
  });
});
