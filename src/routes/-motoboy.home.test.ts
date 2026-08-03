// RC6.5 — Unit tests for driver Home helpers.
import { describe, it, expect } from "vitest";
import { greetingFor, derivePresenceStatus } from "./motoboy";

describe("greetingFor", () => {
  it("returns Bom dia before noon", () => {
    expect(greetingFor(new Date(2026, 0, 1, 8, 0))).toBe("Bom dia");
  });
  it("returns Boa tarde between noon and 18h", () => {
    expect(greetingFor(new Date(2026, 0, 1, 14, 0))).toBe("Boa tarde");
  });
  it("returns Boa noite after 18h", () => {
    expect(greetingFor(new Date(2026, 0, 1, 20, 0))).toBe("Boa noite");
  });
});

describe("derivePresenceStatus", () => {
  it("offline when not connected", () => {
    expect(derivePresenceStatus({ online: false, queueStatus: "AGUARDANDO", hasActive: false })).toBe("offline");
  });
  it("em_entrega when has active assignment", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "AGUARDANDO", hasActive: true })).toBe("em_entrega");
  });
  it("em_entrega when queueStatus is EM_ENTREGA", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "EM_ENTREGA", hasActive: false })).toBe("em_entrega");
  });
  it("retornando after delivery", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "RETORNANDO", hasActive: false })).toBe("retornando");
  });
  it("na_fila when waiting in queue", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "AGUARDANDO", hasActive: false })).toBe("na_fila");
  });
  it("disponivel when online and not queued yet", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "OFFLINE", hasActive: false })).toBe("disponivel");
  });
});
