import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/admin-orders.functions.ts", "utf8");
const routeSource = readFileSync("src/routes/admin.pedidos.tsx", "utf8");

describe("ADMIN-ORD-2 read-only contract", () => {
  it("exposes the required server functions and admin guard", () => {
    expect(source).toContain("export const getAdminOrders");
    expect(source).toContain("export const getAdminOrderDetail");
    expect(source).toContain("requireSupabaseAuth");
    expect(source).toContain("async function assertAdmin");
    expect(source).toContain("supabaseAdmin");
  });

  it("keeps pagination bounded and server-side", () => {
    expect(source).toContain("pageSize ?? 25");
    expect(source).toContain("Math.min(100");
    expect(source).toContain(".range(from, to)");
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).toContain('{ count: "exact" }');
  });

  it("uses the authoritative snapshot without hardcoded finance math", () => {
    expect(source).toContain("order_pricing_snapshot");
    expect(source).toContain("customer_total");
    expect(source).toContain("service_fee_payer");
    expect(source).toContain("realized_platform_revenue");
    expect(source).not.toContain("COMMISSION_RATE");
    expect(source).not.toContain("FIXED_FEE");
    expect(source).not.toMatch(/0\\.99|1\\.49|0\\.05/);
  });

  it("masks phone and provider references", () => {
    expect(source).toContain("maskAdminOrderPhone");
    expect(source).toContain("(**) *****-");
    expect(source).toContain("maskProviderReference");
    expect(source).toContain("provider_reference");
  });

  it("implements only provable alerts requested by ADMIN-ORD-2", () => {
    expect(source).toContain("MISSING_PRICING_SNAPSHOT");
    expect(source).toContain("STATUS_HISTORY_MISMATCH");
    expect(source).toContain("MISSING_APPROVED_PAYMENT");
    expect(source).toContain("MISSING_DELIVERY_ASSIGNMENT");
    expect(source).toContain("PAYMENT_REQUIRED_ORDER_STATUSES");
    expect(source).toContain("DELIVERY_REQUIRED_ORDER_STATUSES");
  });

  it("keeps server functions free from direct mutations and Mercado Pago calls", () => {
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toContain("api.mercadopago.com");
    expect(source).not.toContain("MP_ACCESS_TOKEN");
    expect(source).not.toContain("refresh_token");
    expect(source).not.toContain("access_token");
  });

  it("keeps the route behind server functions instead of browser Supabase reads", () => {
    expect(routeSource).toContain("getAdminOrders");
    expect(routeSource).toContain("getAdminOrderDetail");
    expect(routeSource).toContain("Central de Pedidos");
    expect(routeSource).not.toContain("@/integrations/supabase/client");
    expect(routeSource).not.toMatch(/\.from\s*\(/);
    expect(routeSource).not.toMatch(/\.update\s*\(/);
    expect(routeSource).not.toMatch(/\.insert\s*\(/);
    expect(routeSource).not.toMatch(/\.delete\s*\(/);
  });
});
