import type { OperationsCounters, OperationsMetrics, OperationsOrderCard } from "./types";

function isToday(iso: string, now = Date.now()): boolean {
  const d = new Date(iso), n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function computeCounters(cards: OperationsOrderCard[], now = Date.now()): OperationsCounters {
  const c = { new: 0, preparing: 0, delivering: 0, completedToday: 0, averagePrepMinutes: 0 };
  let prepTotal = 0, prepCount = 0;
  for (const o of cards) {
    if (o.status === "novo" || o.status === "pago") c.new++;
    if (o.status === "em_preparo") { c.preparing++; prepCount++; prepTotal += (now - new Date(o.createdAt).getTime()) / 60000; }
    if (o.status === "saiu_para_entrega") c.delivering++;
    if ((o.status === "entregue" || o.status === "concluido") && isToday(o.createdAt, now)) c.completedToday++;
  }
  c.averagePrepMinutes = prepCount ? Math.round(prepTotal / prepCount) : 0;
  return c;
}

export function computeMetrics(
  cards: OperationsOrderCard[],
  history: Array<{ orderId: string; status: string; at: string }> = [],
  now = Date.now(),
): OperationsMetrics {
  const byOrder = new Map<string, Record<string, number>>();
  for (const h of history) {
    const m = byOrder.get(h.orderId) ?? {};
    m[h.status] = new Date(h.at).getTime();
    byOrder.set(h.orderId, m);
  }
  let prep = 0, prepN = 0, del = 0, delN = 0, tot = 0, totN = 0, cancel = 0;
  for (const c of cards) {
    const m = byOrder.get(c.id) ?? {};
    if (m.em_preparo && m.pronto) { prep += (m.pronto - m.em_preparo) / 60000; prepN++; }
    if (m.saiu_para_entrega && m.entregue) { del += (m.entregue - m.saiu_para_entrega) / 60000; delN++; }
    if (m.novo && (m.entregue || m.concluido)) {
      tot += ((m.entregue ?? m.concluido) - m.novo) / 60000; totN++;
    }
    if (c.status === "cancelado") cancel++;
  }
  const hoursSpan = 1;
  const perHour = cards.filter((c) => (now - new Date(c.createdAt).getTime()) / 3600000 <= hoursSpan).length;
  return {
    avgPrepMinutes: prepN ? Math.round(prep / prepN) : 0,
    avgDeliveryMinutes: delN ? Math.round(del / delN) : 0,
    avgTotalMinutes: totN ? Math.round(tot / totN) : 0,
    cancellations: cancel,
    ordersPerHour: perHour,
  };
}
