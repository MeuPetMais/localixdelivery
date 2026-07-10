import { describe, it, expect, beforeEach } from "vitest";
import { createEtaEngine } from "./eta-engine.service";
import { buildEtaWindow } from "./eta-window";
import { evaluateEtaConfidence } from "./eta-confidence";
import { DEFAULT_ETA_CONFIG } from "./eta.types";
import { DistanceStrategy, haversineMeters } from "./eta-calculator";
import { toCustomerView, toRestaurantView, toOperationsView } from "./eta.mapper";
import { onEtaEvent } from "./eta-events";

const base = {
  assignment_id: "a1",
  restaurant_id: "r1",
  order_id: "o1",
  driver_id: "d1",
  driver_lat: -23.55,
  driver_lng: -46.63,
  destination_lat: -23.56,
  destination_lng: -46.64,
  status: "EM_ROTA",
};

describe("EtaCalculator", () => {
  it("computes distance and eta from strategy", () => {
    const r = DistanceStrategy.estimate({ ...base, now: "2026-01-01T00:00:00Z" } as any, DEFAULT_ETA_CONFIG);
    expect(r.eta_seconds).toBeGreaterThan(0);
    expect(r.distance_km).toBeGreaterThan(0);
  });
  it("haversine ~symmetric", () => {
    const a = haversineMeters(-23.55, -46.63, -23.56, -46.64);
    const b = haversineMeters(-23.56, -46.64, -23.55, -46.63);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });
});

describe("Confidence", () => {
  it("LOW without gps", () => {
    const c = evaluateEtaConfidence({ ...base, driver_lat: null, driver_lng: null } as any, DEFAULT_ETA_CONFIG);
    expect(c.confidence).toBe("LOW");
  });
  it("LOW when very stale", () => {
    const c = evaluateEtaConfidence({ ...base, last_seen_at: "2020-01-01T00:00:00Z", now: "2026-01-01T00:00:00Z" } as any, DEFAULT_ETA_CONFIG);
    expect(c.confidence).toBe("LOW");
  });
  it("HIGH with fresh + high gps", () => {
    const now = new Date().toISOString();
    const c = evaluateEtaConfidence({ ...base, last_seen_at: now, now, location_confidence: "HIGH" } as any, DEFAULT_ETA_CONFIG);
    expect(c.confidence).toBe("HIGH");
  });
});

describe("Window", () => {
  it("produces a range, never single value", () => {
    const w = buildEtaWindow(600, "HIGH", DEFAULT_ETA_CONFIG);
    expect(w.max_seconds).toBeGreaterThan(w.min_seconds);
  });
  it("LOW bumps upper bound", () => {
    const hi = buildEtaWindow(600, "HIGH", DEFAULT_ETA_CONFIG);
    const lo = buildEtaWindow(600, "LOW", DEFAULT_ETA_CONFIG);
    expect(lo.max_seconds).toBeGreaterThan(hi.max_seconds);
  });
});

describe("Engine", () => {
  let engine: ReturnType<typeof createEtaEngine>;
  beforeEach(() => { engine = createEtaEngine(); });

  it("first calc always changes and stores history", () => {
    const now = new Date().toISOString();
    const { changed } = engine.calculate({ ...base, last_seen_at: now, now } as any);
    expect(changed).toBe(true);
    expect(engine.getHistory("a1").length).toBe(1);
  });

  it("skips small changes below significant threshold", () => {
    const now = new Date().toISOString();
    engine.calculate({ ...base, last_seen_at: now, now, speed_ms: 7 } as any);
    const second = engine.calculate({ ...base, last_seen_at: now, now, speed_ms: 7.01 } as any);
    expect(second.changed).toBe(false);
  });

  it("recordActual computes difference", () => {
    const now = new Date().toISOString();
    engine.calculate({ ...base, last_seen_at: now, now } as any);
    const rec = engine.recordActual("a1", 300);
    expect(rec?.difference_seconds).not.toBeNull();
  });

  it("emits EtaChanged on first calc", () => {
    const now = new Date().toISOString();
    const events: string[] = [];
    const off = onEtaEvent((e) => events.push(e.type));
    engine.calculate({ ...base, last_seen_at: now, now } as any);
    off();
    expect(events).toContain("EtaChanged");
    expect(events).toContain("EtaCalculated");
  });
});

describe("Mappers", () => {
  it("customer view hides confidence", () => {
    const engine = createEtaEngine();
    const now = new Date().toISOString();
    const { result } = engine.calculate({ ...base, last_seen_at: now, now } as any);
    const cv = toCustomerView(result);
    expect((cv as any).confidence).toBeUndefined();
    expect(cv.message).toContain("min");
  });
  it("restaurant/operations expose confidence", () => {
    const engine = createEtaEngine();
    const now = new Date().toISOString();
    const { result } = engine.calculate({ ...base, last_seen_at: now, now } as any);
    expect(toRestaurantView(result).confidence).toBeDefined();
    expect(toOperationsView(result).algorithm).toBe("distance");
  });
});
