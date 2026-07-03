import { describe, it, expect } from "vitest";
import { CommunicationPreferenceService } from "./CommunicationPreferenceService";
import { CommunicationEventBus } from "./CommunicationEventBus";
import type { CommunicationEvent } from "./types";

describe("CommunicationPreferenceService.isAllowed", () => {
  const prefs = CommunicationPreferenceService.defaults("c1");

  it("allows enabled channel", () => {
    expect(CommunicationPreferenceService.isAllowed(prefs, "EMAIL")).toBe(true);
  });
  it("blocks disabled channel", () => {
    expect(CommunicationPreferenceService.isAllowed({ ...prefs, email_enabled: false }, "EMAIL")).toBe(false);
  });
  it("blocks marketing when opt-out", () => {
    expect(CommunicationPreferenceService.isAllowed(prefs, "EMAIL", { marketing: true })).toBe(false);
  });
  it("allows marketing when opted in", () => {
    expect(CommunicationPreferenceService.isAllowed({ ...prefs, marketing_enabled: true }, "PUSH", { marketing: true })).toBe(true);
  });
  it("maps every channel to a field", () => {
    for (const c of ["EMAIL", "PUSH", "SMS", "WHATSAPP", "IN_APP"] as const) {
      expect(CommunicationPreferenceService.channelField(c)).toBeTruthy();
    }
  });
});

describe("CommunicationEventBus", () => {
  it("dispatches events to subscribers", async () => {
    const received: CommunicationEvent[] = [];
    const off = CommunicationEventBus.subscribe((e) => { received.push(e); });
    await CommunicationEventBus.publish({
      type: "CommunicationLogged", customerId: "c1", channel: "EMAIL",
      event_type: "test", at: new Date().toISOString(),
    });
    off();
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("CommunicationLogged");
  });

  it("unsubscribes cleanly", async () => {
    const before = CommunicationEventBus._handlerCount();
    const off = CommunicationEventBus.subscribe(() => {});
    expect(CommunicationEventBus._handlerCount()).toBe(before + 1);
    off();
    expect(CommunicationEventBus._handlerCount()).toBe(before);
  });
});
