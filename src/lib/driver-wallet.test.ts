import { describe, it, expect, beforeEach } from "vitest";
import { BRL, DEFAULT_GOALS, delta, formatMinutes, loadGoals, pct, saveGoals } from "./driver-wallet";

describe("driver-wallet helpers", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") window.localStorage.clear();
  });

  it("formats BRL", () => {
    expect(BRL(12.5)).toContain("12,50");
  });

  it("clamps pct to 100", () => {
    expect(pct(30, 10)).toBe(100);
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 10)).toBe(50);
  });

  it("computes delta up/down", () => {
    expect(delta(150, 100)).toEqual({ pct: 50, up: true });
    expect(delta(50, 100)).toEqual({ pct: 50, up: false });
    expect(delta(10, 0)).toEqual({ pct: 100, up: true });
  });

  it("formats minutes as h/m", () => {
    expect(formatMinutes(0)).toBe("—");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(75)).toBe("1h 15min");
    expect(formatMinutes(120)).toBe("2h");
  });

  it.skipIf(typeof window === "undefined")("persists goals per driver", () => {
    expect(loadGoals("d1")).toEqual(DEFAULT_GOALS);
    saveGoals("d1", { daily: 20, weekly: 100, monthly: 400 });
    expect(loadGoals("d1")).toEqual({ daily: 20, weekly: 100, monthly: 400 });
    expect(loadGoals("d2")).toEqual(DEFAULT_GOALS);
  });
});
