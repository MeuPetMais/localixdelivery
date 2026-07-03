import type { OperationsOrderCard, OperationsPriority } from "./types";

const URGENT_MIN = 30;
const LOW_MIN = 5;

/** Classifica prioridade a partir de idade, ETA e atraso do pedido. */
export function classifyPriority(order: {
  createdAt: string;
  etaMinutes?: number;
  vipCustomer?: boolean;
  now?: number;
}): OperationsPriority {
  const now = order.now ?? Date.now();
  const ageMin = (now - new Date(order.createdAt).getTime()) / 60000;
  const eta = order.etaMinutes ?? 0;
  const overdue = ageMin - eta;

  if (order.vipCustomer && ageMin > LOW_MIN) return "URGENT";
  if (overdue > 0 || ageMin >= URGENT_MIN) return "URGENT";
  if (ageMin < LOW_MIN) return "LOW";
  return "NORMAL";
}

export function withPriority(cards: OperationsOrderCard[], now = Date.now()): OperationsOrderCard[] {
  return cards.map((c) => ({
    ...c,
    priority: classifyPriority({ createdAt: c.createdAt, etaMinutes: c.etaMinutes, now }),
  }));
}
