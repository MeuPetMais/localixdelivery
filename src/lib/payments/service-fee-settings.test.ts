import { describe, expect, it } from "vitest";
import { computePricing, DEFAULT_PRICING_SETTINGS } from "./PricingEngine";
import {
  ServiceFeeSettingsError,
  applyServiceFeePayerChange,
  assertServiceFeeSettingsPermission,
  serviceFeePayerOrDefault,
  settingsFromRow,
  type ServiceFeeSettings,
} from "./service-fee-settings";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";

function current(over: Partial<ServiceFeeSettings> = {}): ServiceFeeSettings {
  return {
    restaurantId: RESTAURANT_ID,
    serviceFeePayer: "customer",
    serviceFeeLastChangedAt: null,
    serviceFeeChangeLockedUntil: null,
    ...over,
  };
}

describe("service fee settings", () => {
  it("defaults missing restaurant settings to customer", () => {
    expect(serviceFeePayerOrDefault(undefined)).toBe("customer");
    expect(settingsFromRow(RESTAURANT_ID, null).serviceFeePayer).toBe("customer");
  });

  it("allows customer to restaurant and locks changes for 7 days", () => {
    const result = applyServiceFeePayerChange({
      current: current(),
      next: "restaurant",
      now: NOW,
    });

    expect(result.changed).toBe(true);
    expect(result.settings.serviceFeePayer).toBe("restaurant");
    expect(result.settings.serviceFeeLastChangedAt).toBe("2026-08-10T12:00:00.000Z");
    expect(result.settings.serviceFeeChangeLockedUntil).toBe("2026-08-17T12:00:00.000Z");
  });

  it("rejects immediate rollback while locked", () => {
    expect(() => applyServiceFeePayerChange({
      current: current({
        serviceFeePayer: "restaurant",
        serviceFeeLastChangedAt: "2026-08-10T12:00:00.000Z",
        serviceFeeChangeLockedUntil: "2026-08-17T12:00:00.000Z",
      }),
      next: "customer",
      now: new Date("2026-08-10T12:05:00.000Z"),
    })).toThrow(ServiceFeeSettingsError);

    try {
      applyServiceFeePayerChange({
        current: current({
          serviceFeePayer: "restaurant",
          serviceFeeChangeLockedUntil: "2026-08-17T12:00:00.000Z",
        }),
        next: "customer",
        now: new Date("2026-08-10T12:05:00.000Z"),
      });
    } catch (e) {
      expect(e).toMatchObject({
        code: "service_fee_change_locked",
        details: { locked_until: "2026-08-17T12:00:00.000Z" },
      });
    }
  });

  it("allows change after lock expires", () => {
    const result = applyServiceFeePayerChange({
      current: current({
        serviceFeePayer: "restaurant",
        serviceFeeChangeLockedUntil: "2026-08-17T12:00:00.000Z",
      }),
      next: "customer",
      now: new Date("2026-08-17T12:00:01.000Z"),
    });

    expect(result.changed).toBe(true);
    expect(result.settings.serviceFeePayer).toBe("customer");
  });

  it("same value does not create a new lock", () => {
    const existing = current({
      serviceFeePayer: "customer",
      serviceFeeLastChangedAt: "2026-08-01T00:00:00.000Z",
      serviceFeeChangeLockedUntil: "2026-08-08T00:00:00.000Z",
    });

    const result = applyServiceFeePayerChange({
      current: existing,
      next: "customer",
      now: NOW,
    });

    expect(result.changed).toBe(false);
    expect(result.settings).toBe(existing);
  });

  it("rejects invalid payer value", () => {
    expect(() => applyServiceFeePayerChange({
      current: current(),
      next: "platform",
      now: NOW,
    })).toThrow(ServiceFeeSettingsError);
  });

  it("allows owner and admin to change settings", () => {
    expect(() => assertServiceFeeSettingsPermission({
      userId: "owner-1",
      restaurantOwnerId: "owner-1",
    })).not.toThrow();
    expect(() => assertServiceFeeSettingsPermission({
      userId: "admin-1",
      restaurantOwnerId: "owner-1",
      isAdmin: true,
    })).not.toThrow();
  });

  it("rejects user from another restaurant or without permission", () => {
    expect(() => assertServiceFeeSettingsPermission({
      userId: "user-2",
      restaurantOwnerId: "owner-1",
    })).toThrow(ServiceFeeSettingsError);
    expect(() => assertServiceFeeSettingsPermission({
      userId: "user-2",
      restaurantOwnerId: null,
    })).toThrow(ServiceFeeSettingsError);
  });
});

describe("checkout service fee payer effect", () => {
  it("customer setting makes PricingEngine charge fee to customer", () => {
    const pricing = computePricing(
      { subtotal: 50, serviceFeePayer: "customer" },
      { ...DEFAULT_PRICING_SETTINGS, minimum_order: 0 },
    );

    expect(pricing.serviceFeePayer).toBe("customer");
    expect(pricing.customerTotal).toBe(51.49);
  });

  it("restaurant setting makes PricingEngine charge fee to restaurant", () => {
    const pricing = computePricing(
      { subtotal: 50, serviceFeePayer: "restaurant" },
      { ...DEFAULT_PRICING_SETTINGS, minimum_order: 0 },
    );

    expect(pricing.serviceFeePayer).toBe("restaurant");
    expect(pricing.customerTotal).toBe(50);
    expect(pricing.restaurantNet).toBe(48.51);
  });

  it("frontend cannot override server-selected payer in checkout calculation", () => {
    const frontendValue = "customer";
    const serverValue = settingsFromRow(RESTAURANT_ID, {
      restaurant_id: RESTAURANT_ID,
      service_fee_payer: "restaurant",
    }).serviceFeePayer;
    const pricing = computePricing(
      { subtotal: 50, serviceFeePayer: serverValue },
      { ...DEFAULT_PRICING_SETTINGS, minimum_order: 0 },
    );

    expect(frontendValue).toBe("customer");
    expect(pricing.serviceFeePayer).toBe("restaurant");
  });

  it("snapshot payload keeps the payer used at checkout even if settings change later", () => {
    const oldPricing = computePricing(
      { subtotal: 50, serviceFeePayer: "customer" },
      { ...DEFAULT_PRICING_SETTINGS, minimum_order: 0 },
    );
    const snapshot = { service_fee_payer: oldPricing.serviceFeePayer };
    const newSettings = settingsFromRow(RESTAURANT_ID, {
      restaurant_id: RESTAURANT_ID,
      service_fee_payer: "restaurant",
    });

    expect(newSettings.serviceFeePayer).toBe("restaurant");
    expect(snapshot.service_fee_payer).toBe("customer");
  });
});
