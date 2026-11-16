import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getRestaurantStatus } from "@/lib/restaurant-status";

const orderServiceSource = readFileSync(new URL("./OrderService.ts", import.meta.url), "utf8");
const checkoutHandlerStart = orderServiceSource.indexOf(
  'export const createCheckoutOrder = createServerFn({ method: "POST" })',
);
const checkoutHandlerEnd = orderServiceSource.indexOf("export const previewCheckoutPricing");
const checkoutHandler = orderServiceSource.slice(checkoutHandlerStart, checkoutHandlerEnd);

describe("Gate 4B — closed restaurant checkout guard", () => {
  it("classifies manually closed restaurants as closed even with unrestricted hours", () => {
    const result = getRestaurantStatus({ is_open: false, opening_hours: null });
    expect(result.isOpen).toBe(false);
    expect(result.reason).toBe("manual_closed");
  });

  it("guards order creation on the server before pricing, RPC writes or payment routing", () => {
    const statusCheck = checkoutHandler.indexOf("if (!restaurantStatus.isOpen)");
    const rejection = checkoutHandler.indexOf(
      "throw new Error(getRestaurantClosedMessage(restaurantStatus.reason))",
    );
    const paymentRouting = checkoutHandler.indexOf(
      "const paymentDecision = resolveCheckoutPayment(data.paymentMethod)",
    );
    const pricing = checkoutHandler.indexOf("resolveAuthoritativeCheckoutPricing({");
    const atomicWriter = checkoutHandler.indexOf('"create_order_with_snapshot_payment"');

    expect(checkoutHandlerStart).toBeGreaterThanOrEqual(0);
    expect(checkoutHandlerEnd).toBeGreaterThan(checkoutHandlerStart);
    expect(statusCheck).toBeGreaterThanOrEqual(0);
    expect(rejection).toBeGreaterThan(statusCheck);
    expect(paymentRouting).toBeGreaterThan(rejection);
    expect(pricing).toBeGreaterThan(rejection);
    expect(atomicWriter).toBeGreaterThan(rejection);
  });

  it("checks the isolated Preview environment before loading service-role credentials", () => {
    const isolatedGuard = checkoutHandler.indexOf(
      "gate4b_preview_sandbox_environment_not_verified",
    );
    const serviceRoleImport = checkoutHandler.indexOf("@/integrations/supabase/client.server");
    expect(isolatedGuard).toBeGreaterThanOrEqual(0);
    expect(serviceRoleImport).toBeGreaterThan(isolatedGuard);
  });
});
