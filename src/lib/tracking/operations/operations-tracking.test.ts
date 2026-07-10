import { describe, it, expect } from "vitest";
import { OperationsAlertService } from "./operations-alerts.service";
import { computeMetrics, computeTally, computeQueueEta } from "./operations-metrics";
import { applyFilters } from "./operations-filters";
import type {
  OperationsActiveDelivery, OperationsDriverRow, OperationsQueueRow,
} from "./operations-tracking.types";

const now = Date.parse("2026-07-10T12:00:00Z");

function mkActive(over: Partial<OperationsActiveDelivery> = {}): OperationsActiveDelivery {
  return {
    assignment_id: "a1", order_id: "o1", order_number: 1001,
    customer_name: "Ana", neighborhood: "Centro",
    driver_id: "d1", driver_name: "João",
    status: "EM_ROTA", eta_seconds: 600, confidence: "MEDIUM",
    last_seen_at: new Date(now - 5_000).toISOString(),
    started_at: new Date(now - 5 * 60_000).toISOString(),
    minutes_since_start: 5, is_delayed: false, ...over,
  };
}

function mkDriver(over: Partial<OperationsDriverRow> = {}): OperationsDriverRow {
  return {
    driver_id: "d1", name: "João", state: "EM_ENTREGA", online: true,
    online_since: null, current_order_id: "o1", current_order_number: 1001,
    eta_return_seconds: null, last_seen_at: new Date(now - 5_000).toISOString(), ...over,
  };
}

describe("OperationsAlertService", () => {
  it("cria alerta de pedido parado após 10 min", () => {
    const active = [mkActive({ minutes_since_start: 12, is_delayed: true })];
    const alerts = OperationsAlertService.build(active, [mkDriver()], [], {
      stuck_minutes: 10, heartbeat_lost_seconds: 60, no_movement_seconds: 300, now,
    });
    expect(alerts.some((a) => a.kind === "ORDER_STUCK")).toBe(true);
  });

  it("cria alerta de heartbeat perdido", () => {
    const active = [mkActive({ last_seen_at: new Date(now - 120_000).toISOString() })];
    const alerts = OperationsAlertService.build(active, [mkDriver()], [], {
      stuck_minutes: 30, heartbeat_lost_seconds: 60, no_movement_seconds: 300, now,
    });
    expect(alerts.some((a) => a.kind === "HEARTBEAT_LOST")).toBe(true);
  });

  it("cria alerta de ETA com baixa confiança", () => {
    const active = [mkActive({ confidence: "LOW" })];
    const alerts = OperationsAlertService.build(active, [mkDriver()], [], { ...{ stuck_minutes: 30, heartbeat_lost_seconds: 300, no_movement_seconds: 600, now } });
    expect(alerts.some((a) => a.kind === "ETA_LOW_CONFIDENCE")).toBe(true);
  });

  it("cria alerta de motoboy offline com entrega", () => {
    const alerts = OperationsAlertService.build(
      [mkActive()], [mkDriver({ state: "OFFLINE", online: false })], [],
      { stuck_minutes: 30, heartbeat_lost_seconds: 300, no_movement_seconds: 600, now },
    );
    expect(alerts.some((a) => a.kind === "DRIVER_OFFLINE")).toBe(true);
  });

  it("cria alerta de fila vazia quando há entregas ativas", () => {
    const alerts = OperationsAlertService.build([mkActive()], [mkDriver()], [], {
      stuck_minutes: 30, heartbeat_lost_seconds: 300, no_movement_seconds: 600, now,
    });
    expect(alerts.some((a) => a.kind === "QUEUE_EMPTY")).toBe(true);
  });
});

describe("computeMetrics / computeTally", () => {
  it("calcula ETA médio e maior atraso", () => {
    const m = computeMetrics([
      mkActive({ eta_seconds: 600 }),
      mkActive({ eta_seconds: 1200, is_delayed: true, minutes_since_start: 45 }),
    ]);
    expect(m.active_deliveries).toBe(2);
    expect(m.avg_eta_seconds).toBe(900);
    expect(m.max_delay_minutes).toBe(45);
  });

  it("agrupa motoboys por estado", () => {
    const t = computeTally([
      mkDriver({ state: "AGUARDANDO" }),
      mkDriver({ state: "EM_ENTREGA" }),
      mkDriver({ state: "RETORNANDO" }),
      mkDriver({ state: "OFFLINE" }),
    ]);
    expect(t).toEqual({ disponivel: 1, em_entrega: 1, retornando: 1, pausado: 0, offline: 1 });
  });

  it("estima ETA da fila com base no tempo médio de entrega", () => {
    const q: OperationsQueueRow[] = [
      { position: 1, driver_id: "a", driver_name: "A", waiting_since: "", waiting_minutes: 0, eta_available_seconds: null },
      { position: 2, driver_id: "b", driver_name: "B", waiting_since: "", waiting_minutes: 0, eta_available_seconds: null },
    ];
    const out = computeQueueEta(q, 20);
    expect(out[0].eta_available_seconds).toBeGreaterThan(0);
  });
});

describe("applyFilters", () => {
  it("filtra por busca por cliente/motoboy/pedido", () => {
    const list = [mkActive({ order_number: 1001, customer_name: "Ana" }), mkActive({ order_number: 1002, customer_name: "Bruno" })];
    expect(applyFilters(list, { search: "Ana" })).toHaveLength(1);
    expect(applyFilters(list, { search: "1002" })).toHaveLength(1);
  });

  it("filtra por status e motoboy", () => {
    const list = [
      mkActive({ status: "EM_ROTA", driver_id: "d1" }),
      mkActive({ status: "RETORNANDO", driver_id: "d2" }),
    ];
    expect(applyFilters(list, { status: ["EM_ROTA"] })).toHaveLength(1);
    expect(applyFilters(list, { driverId: "d2" })).toHaveLength(1);
  });
});
