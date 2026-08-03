import { describe, expect, it } from "vitest";
import { getDriverOperationalStatus } from "./driver-operational-status";

describe("getDriverOperationalStatus", () => {
  it("motoboy offline", () => {
    expect(getDriverOperationalStatus({ online: false, driverStatus: "ativo" })).toBe("offline");
  });

  it("motoboy fica online", () => {
    expect(getDriverOperationalStatus({ online: true, driverStatus: "ativo", shiftCurrentState: "ONLINE" }))
      .toBe("disponivel");
  });

  it("motoboy entra na fila", () => {
    expect(getDriverOperationalStatus({ online: true, driverStatus: "ativo", queueStatus: "AGUARDANDO" }))
      .toBe("na_fila");
  });

  it("motoboy recebe uma entrega", () => {
    expect(getDriverOperationalStatus({ online: true, driverStatus: "ativo", hasActiveAssignment: true }))
      .toBe("em_entrega");
  });

  it("motoboy conclui a entrega", () => {
    expect(getDriverOperationalStatus({ online: true, driverStatus: "ativo", shiftCurrentState: "EM_ENTREGA" }))
      .toBe("em_entrega");
  });

  it("motoboy entra em retornando", () => {
    expect(getDriverOperationalStatus({ online: true, driverStatus: "ativo", shiftCurrentState: "RETORNANDO" }))
      .toBe("retornando");
  });

  it("motoboy volta para a fila", () => {
    expect(getDriverOperationalStatus({ online: true, driverStatus: "ativo", queueStatus: "AGUARDANDO" }))
      .toBe("na_fila");
  });

  it("motoboy entra e sai da pausa", () => {
    expect(getDriverOperationalStatus({ online: true, driverStatus: "ativo", shiftStatus: "PAUSADO" }))
      .toBe("pausa");
    expect(getDriverOperationalStatus({ online: true, driverStatus: "ativo", shiftStatus: "ATIVO" }))
      .toBe("disponivel");
  });
});
