import { describe, it, expect } from "vitest";

// Smoke test: garante que o módulo carrega sem erros de import
// e as chaves de API públicas estão presentes.
describe("delivery-drivers.functions", () => {
  it("expõe as funções esperadas", async () => {
    const mod = await import("./delivery-drivers.functions");
    expect(typeof mod.listDrivers).toBe("function");
    expect(typeof mod.createDriver).toBe("function");
    expect(typeof mod.updateDriver).toBe("function");
    expect(typeof mod.deleteDriver).toBe("function");
    expect(typeof mod.getMyDriverProfile).toBe("function");
    expect(typeof mod.setMyPresence).toBe("function");
  });
});
