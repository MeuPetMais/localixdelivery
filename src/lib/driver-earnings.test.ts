import { describe, expect, it } from "vitest";
import {
  calculateDriverEarning,
  DEFAULT_DRIVER_EARNING_SETTINGS,
  resolveDriverEarning,
} from "./driver-earnings";

describe("driver earnings policy", () => {
  it("0 km aplica minimo/base", () => {
    expect(calculateDriverEarning(DEFAULT_DRIVER_EARNING_SETTINGS, 0).amount).toBe(8);
  });

  it("2 km calcula base + por km", () => {
    expect(calculateDriverEarning(DEFAULT_DRIVER_EARNING_SETTINGS, 2).amount).toBe(11);
  });

  it("respeita teto configurado", () => {
    expect(calculateDriverEarning({ base_fee: 8, per_km_fee: 2, minimum_fee: 8, maximum_fee: 12 }, 5).amount).toBe(12);
  });

  it("distancia ausente usa minimo/base sem inventar km", () => {
    const result = calculateDriverEarning(DEFAULT_DRIVER_EARNING_SETTINGS, null);
    expect(result.amount).toBe(8);
    expect(result.distanceKm).toBeNull();
    expect(result.distanceMissing).toBe(true);
  });

  it("alteracao de configuracao nao altera snapshot existente", () => {
    const snapshot = resolveDriverEarning({
      driver_base_fee: 8,
      driver_per_km_fee: 1.5,
      driver_distance_km: 2,
      driver_earning_amount: 11,
      driver_earning_calculated_at: "2026-08-05T10:00:00Z",
    });
    const changed = calculateDriverEarning({ base_fee: 20, per_km_fee: 5, minimum_fee: 20, maximum_fee: null }, 2);
    expect(snapshot.amount).toBe(11);
    expect(changed.amount).toBe(30);
  });

  it("assignment legado usa fallback controlado", () => {
    const legacy = resolveDriverEarning({ driver_distance_km: 2 });
    expect(legacy.amount).toBe(11);
    expect(legacy.source).toBe("legacy_fallback");
  });
});
