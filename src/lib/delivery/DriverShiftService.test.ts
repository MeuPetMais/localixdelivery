import { describe, it, expect } from "vitest";
import { accumulate, summarize, ZERO_ACC, fmtMinutes } from "./DriverShiftService";
import { EVENT_TO_STATE } from "./DriverShiftStateMachine";

describe("DriverShiftService", () => {
  it("acumula minutos no estado correto", () => {
    const a = accumulate(ZERO_ACC, "AGUARDANDO", "2026-01-01T10:00:00Z", "2026-01-01T10:15:00Z");
    expect(a.waiting_minutes).toBe(15);
    const b = accumulate(a, "EM_ENTREGA", "2026-01-01T10:15:00Z", "2026-01-01T10:45:00Z");
    expect(b.delivery_minutes).toBe(30);
    expect(b.waiting_minutes).toBe(15);
  });

  it("OFFLINE não acumula", () => {
    const a = accumulate(ZERO_ACC, "OFFLINE", "2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z");
    expect(a).toEqual(ZERO_ACC);
  });

  it("summarize soma total", () => {
    const s = summarize({ ...ZERO_ACC, waiting_minutes: 10, delivery_minutes: 20 });
    expect(s.total_minutes).toBe(30);
  });

  it("mapeia eventos para estados", () => {
    expect(EVENT_TO_STATE.DELIVERY_FINISHED).toBe("RETORNANDO");
    expect(EVENT_TO_STATE.PAUSE_STARTED).toBe("PAUSA");
    expect(EVENT_TO_STATE.SHIFT_FINISHED).toBe("OFFLINE");
  });

  it("formata minutos em h/m", () => {
    expect(fmtMinutes(45)).toBe("45m");
    expect(fmtMinutes(75)).toBe("1h 15m");
    expect(fmtMinutes(120)).toBe("2h 00m");
  });
});
