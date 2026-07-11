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
  it("PAUSA when offline", () => {
    expect(derivePresenceStatus({ online: false, queueStatus: "AGUARDANDO", hasActive: false })).toBe("PAUSA");
  });
  it("EM_ENTREGA when has active assignment", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "AGUARDANDO", hasActive: true })).toBe("EM_ENTREGA");
  });
  it("EM_ENTREGA when queueStatus is EM_ENTREGA", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "EM_ENTREGA", hasActive: false })).toBe("EM_ENTREGA");
  });
  it("RETORNANDO after delivery", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "RETORNANDO", hasActive: false })).toBe("RETORNANDO");
  });
  it("DISPONIVEL when online and idle", () => {
    expect(derivePresenceStatus({ online: true, queueStatus: "AGUARDANDO", hasActive: false })).toBe("DISPONIVEL");
  });
});
