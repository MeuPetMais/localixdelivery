import { describe, it, expect } from "vitest";
import {
  classifyDriver, averageMinutes, returnGapsMinutes,
  type AssignmentLite,
} from "./operations-central";

const drv = (over: Partial<{ status: string; online: boolean }> = {}) => ({
  id: "d1", status: over.status ?? "ativo", online: over.online ?? false,
});

describe("classifyDriver", () => {
  it("pausa quando afastado (mesmo online)", () => {
    expect(classifyDriver(drv({ status: "afastado", online: true }), undefined, undefined)).toBe("pausa");
  });
  it("em_entrega quando há atribuição ativa", () => {
    expect(classifyDriver(drv({ online: true }), undefined, {
      driver_id: "d1", status: "EM_ROTA", assigned_at: null, delivered_at: null,
    })).toBe("em_entrega");
  });
  it("retornando quando queue.status = RETORNANDO", () => {
    expect(classifyDriver(drv({ online: true }), { driver_id: "d1", status: "RETORNANDO", position: 0 }, undefined))
      .toBe("retornando");
  });
  it("fila quando AGUARDANDO na fila", () => {
    expect(classifyDriver(drv({ online: true }), { driver_id: "d1", status: "AGUARDANDO", position: 1 }, undefined))
      .toBe("fila");
  });
  it("fila quando online sem fila explícita", () => {
    expect(classifyDriver(drv({ online: true }), undefined, undefined)).toBe("fila");
  });
  it("offline quando não online e sem nada", () => {
    expect(classifyDriver(drv({ online: false }), undefined, undefined)).toBe("offline");
  });
  it("ignora atribuição terminada", () => {
    expect(classifyDriver(drv({ online: true }), undefined, {
      driver_id: "d1", status: "ENTREGUE", assigned_at: null, delivered_at: null,
    })).toBe("fila");
  });
});

describe("averageMinutes", () => {
  it("null quando vazio", () => expect(averageMinutes([])).toBeNull());
  it("média inteira arredondada", () => expect(averageMinutes([10, 20, 33])).toBe(21));
});

describe("returnGapsMinutes", () => {
  it("calcula gap entre entrega e próxima atribuição por motoboy", () => {
    const a: AssignmentLite[] = [
      { driver_id: "d1", status: "ENTREGUE", assigned_at: "2025-06-01T10:00:00Z", delivered_at: "2025-06-01T10:20:00Z" },
      { driver_id: "d1", status: "ATRIBUIDO", assigned_at: "2025-06-01T10:30:00Z", delivered_at: null },
    ];
    expect(returnGapsMinutes(a)).toEqual([10]);
  });
  it("descarta gaps > 120min ou negativos", () => {
    const a: AssignmentLite[] = [
      { driver_id: "d1", status: "ENTREGUE", assigned_at: "2025-06-01T08:00:00Z", delivered_at: "2025-06-01T08:20:00Z" },
      { driver_id: "d1", status: "ATRIBUIDO", assigned_at: "2025-06-01T14:00:00Z", delivered_at: null },
    ];
    expect(returnGapsMinutes(a)).toEqual([]);
  });
  it("separa por motoboy", () => {
    const a: AssignmentLite[] = [
      { driver_id: "d1", status: "ENTREGUE", assigned_at: "2025-06-01T10:00:00Z", delivered_at: "2025-06-01T10:20:00Z" },
      { driver_id: "d2", status: "ATRIBUIDO", assigned_at: "2025-06-01T10:25:00Z", delivered_at: null },
    ];
    expect(returnGapsMinutes(a)).toEqual([]);
  });
});
