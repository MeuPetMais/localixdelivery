import { describe, expect, it } from "vitest";
import { sumDriverEarnings } from "./driver-dashboard.functions";

describe("driver dashboard earnings", () => {
  it("ganhos de hoje soma snapshots", () => {
    expect(sumDriverEarnings([
      {
        id: "1",
        distance_km: 99,
        delivered_at: "2026-08-05T10:00:00Z",
        driver_earning_amount: 10,
        driver_earning_calculated_at: "2026-08-05T10:00:00Z",
      },
      {
        id: "2",
        distance_km: 99,
        delivered_at: "2026-08-05T11:00:00Z",
        driver_earning_amount: 12.5,
        driver_earning_calculated_at: "2026-08-05T11:00:00Z",
      },
    ])).toBe(22.5);
  });

  it("ganhos de hoje usa fallback legado controlado", () => {
    expect(sumDriverEarnings([
      { id: "1", distance_km: 2, delivered_at: "2026-08-05T10:00:00Z" },
    ])).toBe(11);
  });
});
