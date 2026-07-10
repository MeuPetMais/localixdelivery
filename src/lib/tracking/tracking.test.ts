// Tracking Domain — Testes de núcleo (RC5.3.a).
import { describe, it, expect, beforeEach } from "vitest";
import { createTrackingService } from "./tracking.service";
import { createTrackingOrchestrator } from "./tracking.orchestrator";
import { trackingEventBus, type TrackingEventEnvelope } from "./tracking.events";
import { toPublicPayload } from "./tracking.mapper";
import { trackingChannelNames } from "./tracking.realtime";

const baseInput = {
  assignment_id: "11111111-1111-1111-1111-111111111111",
  driver_id: "22222222-2222-2222-2222-222222222222",
  restaurant_id: "33333333-3333-3333-3333-333333333333",
  order_id: "44444444-4444-4444-4444-444444444444",
  status: "ATRIBUIDO" as const,
};

describe("TrackingService", () => {
  const svc = createTrackingService();
  beforeEach(() => svc._reset());

  it("cria snapshot único por assignment e atualiza in-place", () => {
    const a = svc.createSnapshot(baseInput);
    const b = svc.createSnapshot({ ...baseInput, status: "COLETANDO" });
    expect(a.id).toBe(b.id);
    expect(b.status).toBe("COLETANDO");
  });

  it("patch atualiza campos e mantém identidade", () => {
    svc.createSnapshot(baseInput);
    const patched = svc.updateSnapshot(baseInput.assignment_id, { eta_seconds: 600, confidence: "HIGH" });
    expect(patched?.eta_seconds).toBe(600);
    expect(patched?.confidence).toBe("HIGH");
  });

  it("timeline é append-only", () => {
    svc.appendTimeline({ ...baseInput, driver_id: baseInput.driver_id, event: "snapshot_created", correlation_id: "c" });
    svc.appendTimeline({ ...baseInput, driver_id: baseInput.driver_id, event: "status_changed", correlation_id: "c" });
    const { timeline } = svc.currentTracking(baseInput.assignment_id);
    expect(timeline.length).toBe(2);
  });
});

describe("TrackingOrchestrator", () => {
  const svc = createTrackingService();
  const orch = createTrackingOrchestrator({ service: svc });
  const events: TrackingEventEnvelope[] = [];
  let unsub: (() => void) | null = null;

  beforeEach(() => {
    svc._reset();
    events.length = 0;
    unsub?.();
    unsub = trackingEventBus.subscribe((e) => events.push(e));
  });

  it("createSnapshot publica TrackingCreated + snapshot updated", async () => {
    await orch.createSnapshot(baseInput);
    const types = events.map((e) => e.type);
    expect(types).toContain("TrackingCreated");
    expect(types).toContain("TrackingSnapshotUpdated");
  });

  it("updateSnapshot com status novo publica TrackingStatusChanged", async () => {
    await orch.createSnapshot(baseInput);
    events.length = 0;
    await orch.updateSnapshot(baseInput.assignment_id, { status: "EM_ROTA" });
    const types = events.map((e) => e.type);
    expect(types).toContain("TrackingStatusChanged");
    expect(types).toContain("TrackingSnapshotUpdated");
  });

  it("updateSnapshot sem mudança de status não emite StatusChanged", async () => {
    await orch.createSnapshot(baseInput);
    events.length = 0;
    await orch.updateSnapshot(baseInput.assignment_id, { eta_seconds: 900 });
    expect(events.some((e) => e.type === "TrackingStatusChanged")).toBe(false);
  });

  it("registerEvent adiciona timeline e publica TrackingTimelineUpdated", async () => {
    await orch.createSnapshot(baseInput);
    events.length = 0;
    await orch.registerEvent({ assignment_id: baseInput.assignment_id, event: "custom" });
    expect(events.some((e) => e.type === "TrackingTimelineUpdated")).toBe(true);
  });
});

describe("Contracts & Realtime channels", () => {
  it("payload público não expõe coordenadas", () => {
    const svc = createTrackingService();
    const snap = svc.createSnapshot(baseInput);
    const patched = svc.updateSnapshot(snap.assignment_id, { last_lat: -23.5, last_lng: -46.6 })!;
    const payload = toPublicPayload(patched);
    expect(payload).not.toHaveProperty("last_lat");
    expect(payload).not.toHaveProperty("last_lng");
    expect(payload.status).toBe(baseInput.status);
  });

  it("nomes de canais seguem manifesto", () => {
    expect(trackingChannelNames.restaurant("r1")).toBe("tracking-r1");
    expect(trackingChannelNames.publicOrder("o1")).toBe("tracking-public-o1");
    expect(trackingChannelNames.driver("d1")).toBe("tracking-driver-d1");
  });
});
