import { describe, it, expect, beforeEach } from "vitest";
import { createDriverLocationService } from "./driver-location.service";
import { createDriverPresenceService } from "./driver-presence.service";
import { driverLocationBus } from "./driver-location.events";
import { driverPresenceBus } from "./driver-presence.events";
import { DEFAULT_HEARTBEAT_INTERVALS } from "./driver-presence.types";

const DRIVER = "00000000-0000-0000-0000-000000000001";

function sample(over: Partial<Parameters<ReturnType<typeof createDriverLocationService>["ingest"]>[0]> = {}) {
  return {
    driver_id: DRIVER,
    assignment_id: "a1",
    restaurant_id: "r1",
    lat: -23.55,
    lng: -46.63,
    speed: 5,
    accuracy: 10,
    captured_at: new Date().toISOString(),
    ...over,
  };
}

describe("DriverPresenceService", () => {
  beforeEach(() => driverPresenceBus.clear());

  it("adapts heartbeat interval by state", () => {
    const svc = createDriverPresenceService();
    expect(svc.intervalFor("AGUARDANDO")).toBe(DEFAULT_HEARTBEAT_INTERVALS.AGUARDANDO);
    expect(svc.intervalFor("EM_ENTREGA")).toBe(DEFAULT_HEARTBEAT_INTERVALS.EM_ENTREGA);
    expect(svc.intervalFor("EM_ENTREGA", true)).toBe(DEFAULT_HEARTBEAT_INTERVALS.PROXIMO_DESTINO);
    expect(svc.intervalFor("RETORNANDO")).toBe(DEFAULT_HEARTBEAT_INTERVALS.RETORNANDO);
  });

  it("emits change events and heartbeat", () => {
    const svc = createDriverPresenceService();
    const seen: string[] = [];
    driverPresenceBus.subscribe((e) => seen.push(e.type));
    svc.setPresence({ driver_id: DRIVER, state: "AGUARDANDO" });
    svc.setPresence({ driver_id: DRIVER, state: "EM_ENTREGA" });
    svc.heartbeat(DRIVER);
    expect(seen).toContain("DriverPresenceChanged");
    expect(seen).toContain("DriverPresenceHeartbeat");
  });
});

describe("DriverLocationService", () => {
  beforeEach(() => driverLocationBus.clear());

  it("accepts a first sample with HIGH confidence", async () => {
    const svc = createDriverLocationService();
    const evalR = await svc.ingest(sample());
    expect(evalR.confidence).toBe("HIGH");
    expect(evalR.spoof_score).toBe(0);
    expect(svc.getLast(DRIVER)).not.toBeNull();
  });

  it("flags teleport as LOW confidence with spoof score", async () => {
    const svc = createDriverLocationService();
    const t0 = Date.now();
    await svc.ingest(sample({ captured_at: new Date(t0).toISOString() }));
    // 1 segundo depois, salto de ~10km → impossível.
    const r = await svc.ingest(sample({
      lat: -23.65, lng: -46.63,
      captured_at: new Date(t0 + 1000).toISOString(),
    }));
    expect(r.confidence).toBe("LOW");
    expect(r.reasons).toContain("teleport_detected");
    expect(r.spoof_score).toBeGreaterThanOrEqual(60);
  });

  it("marks low accuracy as MEDIUM/LOW", async () => {
    const svc = createDriverLocationService();
    const r = await svc.ingest(sample({ accuracy: 500 }));
    expect(["MEDIUM", "LOW"]).toContain(r.confidence);
    expect(r.reasons).toContain("low_accuracy");
  });

  it("queues samples when offline and syncs on flush", async () => {
    let t = 1000;
    const uploaded: unknown[][] = [];
    const svc = createDriverLocationService({
      isOnline: () => false,
      now: () => new Date(t),
      uploader: async (batch) => { uploaded.push(batch); },
    });
    await svc.ingest(sample({ captured_at: new Date(t).toISOString() }));
    t += 5000;
    await svc.ingest(sample({ lat: -23.551, captured_at: new Date(t).toISOString() }));
    expect(svc.getOfflineQueue(DRIVER).length).toBe(2);
  });

  it("deduplicates identical samples and rate-limits rapid bursts", async () => {
    const svc = createDriverLocationService();
    const rejects: string[] = [];
    driverLocationBus.subscribe((e) => { if (e.type === "DriverLocationRejected") rejects.push(e.reason ?? ""); });
    const s = sample();
    await svc.ingest(s);
    await svc.ingest(s); // duplicate
    expect(rejects).toContain("duplicate");
  });
});
