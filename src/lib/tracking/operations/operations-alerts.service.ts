// Operations Alerts — deriva alertas a partir do estado observado.
// Puro. Sem I/O. Consumido pelo dashboard.

import type {
  OperationsActiveDelivery, OperationsAlert, OperationsDriverRow, OperationsQueueRow,
} from "./operations-tracking.types";

export interface OperationsAlertConfig {
  stuck_minutes: number;         // pedido sem status change
  heartbeat_lost_seconds: number; // sem last_seen_at
  no_movement_seconds: number;   // driver parado
  now?: number;
}

export const DEFAULT_ALERT_CONFIG: OperationsAlertConfig = {
  stuck_minutes: 10,
  heartbeat_lost_seconds: 60,
  no_movement_seconds: 300,
};

export const OperationsAlertService = {
  build(
    active: OperationsActiveDelivery[],
    drivers: OperationsDriverRow[],
    queue: OperationsQueueRow[],
    config: OperationsAlertConfig = DEFAULT_ALERT_CONFIG,
  ): OperationsAlert[] {
    const now = config.now ?? Date.now();
    const alerts: OperationsAlert[] = [];

    for (const d of active) {
      if (d.minutes_since_start >= config.stuck_minutes && d.status !== "ENTREGUE") {
        alerts.push({
          id: `stuck:${d.assignment_id}`,
          kind: "ORDER_STUCK", severity: "critical",
          title: `Pedido #${d.order_number ?? "—"} parado há ${d.minutes_since_start}min`,
          detail: `Cliente ${d.customer_name}. Status atual: ${d.status}.`,
          ref_order_id: d.order_id, ref_driver_id: d.driver_id,
          at: new Date(now).toISOString(),
        });
      }
      if (d.last_seen_at) {
        const gap = (now - new Date(d.last_seen_at).getTime()) / 1000;
        if (gap >= config.heartbeat_lost_seconds) {
          alerts.push({
            id: `heartbeat:${d.driver_id}`,
            kind: "HEARTBEAT_LOST", severity: gap > config.no_movement_seconds ? "critical" : "warn",
            title: `Heartbeat perdido — ${d.driver_name}`,
            detail: `Sem sinal há ${Math.floor(gap)}s.`,
            ref_driver_id: d.driver_id, ref_order_id: d.order_id,
            at: new Date(now).toISOString(),
          });
        }
      }
      if (d.confidence === "LOW") {
        alerts.push({
          id: `eta:${d.assignment_id}`,
          kind: "ETA_LOW_CONFIDENCE", severity: "info",
          title: `ETA com baixa confiança — Pedido #${d.order_number ?? "—"}`,
          detail: `Motoboy ${d.driver_name}.`,
          ref_order_id: d.order_id, ref_driver_id: d.driver_id,
          at: new Date(now).toISOString(),
        });
      }
    }

    for (const d of drivers) {
      if (d.state === "OFFLINE" && d.current_order_id) {
        alerts.push({
          id: `offline:${d.driver_id}`,
          kind: "DRIVER_OFFLINE", severity: "critical",
          title: `Motoboy offline — ${d.name}`,
          detail: `Possui entrega em andamento.`,
          ref_driver_id: d.driver_id, ref_order_id: d.current_order_id,
          at: new Date(now).toISOString(),
        });
      }
    }

    if (queue.length === 0 && active.length > 0) {
      alerts.push({
        id: "queue:empty",
        kind: "QUEUE_EMPTY", severity: "warn",
        title: "Fila vazia",
        detail: "Nenhum motoboy aguardando para próxima entrega.",
        at: new Date(now).toISOString(),
      });
    }
    return alerts;
  },
};
