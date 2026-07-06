import { describe, it, expect } from "vitest";
import { ServiceFeeService } from "./ServiceFeeService";
import { RevenuePolicyService } from "./RevenuePolicyService";
import { DEFAULT_POLICY } from "./RevenueSettingsService";
import type { RevenuePolicy } from "./types";

describe("PlatformRevenue Domain", () => {
  it("TIERED: até 30 aplica 0.99", () => {
    const r = ServiceFeeService.compute(DEFAULT_POLICY, { subtotal: 25 });
    expect(r.amount).toBe(0.99);
    expect(r.type).toBe("TIERED");
  });
  it("TIERED: acima de 30 aplica 1.49", () => {
    const r = ServiceFeeService.compute(DEFAULT_POLICY, { subtotal: 40 });
    expect(r.amount).toBe(1.49);
  });
  it("FIXED aplica valor bruto", () => {
    const p: RevenuePolicy = { ...DEFAULT_POLICY, service_fee_type: "FIXED", service_fee_value: 2.5 };
    expect(ServiceFeeService.compute(p, { subtotal: 100 }).amount).toBe(2.5);
  });
  it("PERCENTAGE aplica sobre subtotal", () => {
    const p: RevenuePolicy = { ...DEFAULT_POLICY, service_fee_type: "PERCENTAGE", service_fee_value: 5 };
    expect(ServiceFeeService.compute(p, { subtotal: 100 }).amount).toBe(5);
  });
  it("Desativada retorna zero", () => {
    const p: RevenuePolicy = { ...DEFAULT_POLICY, service_fee_enabled: false };
    expect(ServiceFeeService.compute(p, { subtotal: 50 }).amount).toBe(0);
  });
  it("Fora da vigência não está ativa", () => {
    const past: RevenuePolicy = { ...DEFAULT_POLICY, effective_until: "2000-01-01T00:00:00Z" };
    expect(RevenuePolicyService.isActive(past)).toBe(false);
  });
  it("Dentro da vigência está ativa", () => {
    expect(RevenuePolicyService.isActive(DEFAULT_POLICY)).toBe(true);
  });
});
