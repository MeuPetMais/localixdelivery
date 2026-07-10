// Operations Metrics — indicadores agregados. Puro, sem I/O.

import type { TrackingConfidence } from "../tracking.types";
import type {
  OperationsActiveDelivery, OperationsDriverRow, OperationsMetrics,
  OperationsDrivertally, OperationsQueueRow,
} from "./operations-tracking.types";

const CONF_WEIGHT: Record<TrackingConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const CONF_FROM: Record<number, TrackingConfidence> = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

export function computeMetrics(
  active: OperationsActiveDelivery[],
  history: { delivery_minutes?: number; return_minutes?: number; wait_minutes?: number;
             success?: boolean; eta_accuracy?: number }[] = [],
): OperationsMetrics {
  const etaVals = active.map((a) => a.eta_seconds).filter((x): x is number => x != null);
  const avgEta = etaVals.length ? Math.round(etaVals.reduce((a, b) => a + b, 0) / etaVals.length) : null;
  const maxDelay = active.reduce((m, a) => Math.max(m, a.is_delayed ? a.minutes_since_start : 0), 0);

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const del = history.map((h) => h.delivery_minutes).filter((x): x is number => x != null);
  const ret = history.map((h) => h.return_minutes).filter((x): x is number => x != null);
  const wait = history.map((h) => h.wait_minutes).filter((x): x is number => x != null);
  const successes = history.filter((h) => h.success === true).length;
  const failures = history.filter((h) => h.success === false).length;
  const total = successes + failures;
  const accVals = history.map((h) => h.eta_accuracy).filter((x): x is number => x != null);

  const confWeights = active.map((a) => CONF_WEIGHT[a.confidence]);
  const avgConfW = confWeights.length ? Math.round(confWeights.reduce((a, b) => a + b, 0) / confWeights.length) : 2;
  return {
    active_deliveries: active.length,
    avg_eta_seconds: avgEta,
    max_delay_minutes: maxDelay,
    avg_delivery_minutes: del.length ? Math.round((avg(del) ?? 0)) : null,
    avg_return_minutes: ret.length ? Math.round((avg(ret) ?? 0)) : null,
    avg_wait_minutes: wait.length ? Math.round((avg(wait) ?? 0)) : null,
    success_rate: total ? successes / total : null,
    eta_accuracy: accVals.length ? avg(accVals) : null,
    avg_confidence: CONF_FROM[avgConfW] ?? "MEDIUM",
  };
}

export function computeTally(drivers: OperationsDriverRow[]): OperationsDrivertally {
  const t: OperationsDrivertally = { disponivel: 0, em_entrega: 0, retornando: 0, pausado: 0, offline: 0 };
  for (const d of drivers) {
    if (d.state === "AGUARDANDO") t.disponivel++;
    else if (d.state === "EM_ENTREGA") t.em_entrega++;
    else if (d.state === "RETORNANDO") t.retornando++;
    else if (d.state === "PAUSA") t.pausado++;
    else t.offline++;
  }
  return t;
}

export function computeQueueEta(queue: OperationsQueueRow[], avgDeliveryMinutes: number | null): OperationsQueueRow[] {
  if (avgDeliveryMinutes == null) return queue;
  return queue.map((q, i) => ({
    ...q,
    eta_available_seconds: Math.round((avgDeliveryMinutes * 60) * (i + 1) / Math.max(queue.length, 1)),
  }));
}
