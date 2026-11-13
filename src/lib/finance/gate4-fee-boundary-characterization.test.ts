import { describe, expect, it } from "vitest";
import { computePricing, DEFAULT_PRICING_SETTINGS } from "@/lib/payments/PricingEngine";

// Gate 4 / DEC-015 — characterization, not authorization to change the database.
// This mirrors the currently audited BEFORE INSERT trigger's NEW.total threshold;
// it does NOT execute PostgreSQL triggers, RPCs, or Mercado Pago.
const settings = { ...DEFAULT_PRICING_SETTINGS, minimum_order: 0 };
const beforeInsertFee = (orderTotal: number) => (orderTotal <= 30 ? 0.99 : 1.49);

describe("Gate 4 — subtotal fee boundary and legacy trigger characterization", () => {
  for (const payer of ["customer", "restaurant"] as const) {
    for (const [subtotal, expectedFee] of [
      [29.99, 0.99],
      [30, 0.99],
      [30.01, 1.49],
    ] as const) {
      it(`uses subtotal ${subtotal} and payer ${payer} as authoritative fee basis`, () => {
        const pricing = computePricing({ subtotal, serviceFeePayer: payer }, settings);
        expect(pricing.platformFee).toBe(expectedFee);
        expect(pricing.serviceFeePayer).toBe(payer);
        expect(pricing.customerTotal).toBe(
          Math.round((subtotal + (payer === "customer" ? expectedFee : 0)) * 100) / 100,
        );
        expect(pricing.restaurantNet).toBe(
          Math.round((subtotal - (payer === "restaurant" ? expectedFee : 0)) * 100) / 100,
        );
      });
    }
  }

  it.each([29.99, 30] as const)(
    "characterizes the legacy trigger mismatch when customer pays at subtotal %s",
    (subtotal) => {
      const pricing = computePricing({ subtotal, serviceFeePayer: "customer" }, settings);
      expect(pricing.platformFee).toBe(0.99);
      expect(beforeInsertFee(pricing.customerTotal)).toBe(1.49);
      expect(beforeInsertFee(pricing.customerTotal)).not.toBe(pricing.platformFee);
    },
  );

  it("characterizes delivery pushing total across the boundary without changing the fee tier", () => {
    const pricing = computePricing(
      { subtotal: 29, deliveryFee: 5, serviceFeePayer: "restaurant" },
      settings,
    );
    expect(pricing.platformFee).toBe(0.99);
    expect(pricing.customerTotal).toBe(34);
    expect(beforeInsertFee(pricing.customerTotal)).toBe(1.49);
  });

  it("characterizes a discount lowering customer total without changing subtotal fee tier", () => {
    const pricing = computePricing(
      { subtotal: 30.01, couponDiscount: 5, serviceFeePayer: "customer" },
      settings,
    );
    expect(pricing.platformFee).toBe(1.49);
    expect(pricing.customerTotal).toBe(26.5);
    expect(beforeInsertFee(pricing.customerTotal)).toBe(0.99);
  });

  it("does not claim that a mirrored snapshot fee proves historical order rows are reconciled", () => {
    const historicalStagingObservation = {
      orderPlatformFee: 1.46,
      snapshotPlatformFee: 0.99,
      orderFixedFee: 0.99,
    };
    expect(historicalStagingObservation.orderPlatformFee).not.toBe(
      historicalStagingObservation.snapshotPlatformFee,
    );
    expect(historicalStagingObservation.orderFixedFee).toBe(
      historicalStagingObservation.snapshotPlatformFee,
    );
  });
});
