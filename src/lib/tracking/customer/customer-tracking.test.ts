import { describe, it, expect } from "vitest";
import { CustomerTrackingMessageService } from "./customer-tracking.messages";
import { buildCustomerView, etaWindowMinutes } from "./customer-tracking.builder";

describe("CustomerTrackingMessageService", () => {
  it("derives step from order + tracking status", () => {
    expect(CustomerTrackingMessageService.stepFrom("novo", null)).toBe("pedido_recebido");
    expect(CustomerTrackingMessageService.stepFrom("em_preparo", null)).toBe("em_preparo");
    expect(CustomerTrackingMessageService.stepFrom("pronto", null)).toBe("pronto");
    expect(CustomerTrackingMessageService.stepFrom("saiu_para_entrega", "EM_ROTA")).toBe("saiu_para_entrega");
    expect(CustomerTrackingMessageService.stepFrom("saiu_para_entrega", "PROXIMO_AO_DESTINO")).toBe("proximo_do_destino");
    expect(CustomerTrackingMessageService.stepFrom("entregue", null)).toBe("entregue");
    expect(CustomerTrackingMessageService.stepFrom("cancelado", null)).toBe("cancelado");
  });

  it("humanizes messages and includes driver name", () => {
    const m = CustomerTrackingMessageService.messageFor("saiu_para_entrega", { driver_name: "João" });
    expect(m).toContain("João");
    expect(CustomerTrackingMessageService.messageFor("pedido_recebido")).toMatch(/recebido/i);
    expect(CustomerTrackingMessageService.messageFor("entregue")).toMatch(/Bom apetite/i);
  });

  it("eta label uses window and never confidence", () => {
    expect(CustomerTrackingMessageService.etaLabel(7, 9)).toBe("Chega entre 7 e 9 minutos.");
    expect(CustomerTrackingMessageService.etaLabel(null, null)).toBeNull();
  });

  it("freshness label relative to now", () => {
    const now = new Date("2026-07-10T12:00:00Z").getTime();
    expect(CustomerTrackingMessageService.freshnessLabel(new Date(now - 2000).toISOString(), now)).toBe("Atualizado agora");
    expect(CustomerTrackingMessageService.freshnessLabel(new Date(now - 15000).toISOString(), now)).toBe("Atualizado há 15 segundos");
    expect(CustomerTrackingMessageService.freshnessLabel(new Date(now - 60000).toISOString(), now)).toBe("Atualizado há 1 minuto");
    expect(CustomerTrackingMessageService.freshnessLabel(new Date(now - 180000).toISOString(), now)).toBe("Atualizado há 3 minutos");
  });

  it("offline message never leaks technical error", () => {
    expect(CustomerTrackingMessageService.offlineMessage()).not.toMatch(/error|failed|500/i);
  });
});

describe("etaWindowMinutes", () => {
  it("returns null window for null / non-positive eta", () => {
    expect(etaWindowMinutes(null)).toEqual({ min: null, max: null });
    expect(etaWindowMinutes(0)).toEqual({ min: null, max: null });
  });
  it("computes 0.85 – 1.20 window in minutes", () => {
    const { min, max } = etaWindowMinutes(600); // 10 min
    expect(min).toBeCloseTo(8.5, 5);
    expect(max).toBeCloseTo(12, 5);
  });
});

describe("buildCustomerView", () => {
  it("builds view for saiu_para_entrega with eta window and driver name", () => {
    const v = buildCustomerView("11111111-1111-1111-1111-111111111111", {
      order_status: "saiu_para_entrega",
      tracking_status: "EM_ROTA",
      eta_seconds: 480,
      driver_name: "João",
      updated_at: "2026-07-10T12:00:00Z",
    });
    expect(v.step).toBe("saiu_para_entrega");
    expect(v.eta_label).toMatch(/Chega entre \d+ e \d+ minutos\./);
    expect(v.driver_name).toBe("João");
    expect(v.has_tracking).toBe(true);
  });

  it("hides eta when delivered or cancelled", () => {
    const delivered = buildCustomerView("o", {
      order_status: "entregue", tracking_status: "ENTREGUE", eta_seconds: 300,
      driver_name: null, updated_at: null,
    });
    expect(delivered.eta_label).toBeNull();
    expect(delivered.step).toBe("entregue");

    const cancelled = buildCustomerView("o", {
      order_status: "cancelado", tracking_status: null, eta_seconds: 300,
      driver_name: null, updated_at: null,
    });
    expect(cancelled.eta_label).toBeNull();
    expect(cancelled.step).toBe("cancelado");
  });

  it("never exposes confidence or gps coords in the view type surface", () => {
    const v = buildCustomerView("o", {
      order_status: "em_preparo", tracking_status: null, eta_seconds: null,
      driver_name: null, updated_at: null,
    });
    expect(Object.keys(v)).not.toContain("last_lat");
    expect(Object.keys(v)).not.toContain("last_lng");
    expect(Object.keys(v)).not.toContain("confidence");
  });
});
