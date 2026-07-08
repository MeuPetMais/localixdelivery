import type { OperationsAlert, OperationsOrderCard } from "./types";

const LATE_THRESHOLD_MIN = 30;
const DRIVER_LATE_MIN = 20;

export function buildAlerts(
  cards: OperationsOrderCard[],
  opts: { restaurantOpen?: boolean; now?: number } = {},
): OperationsAlert[] {
  const now = opts.now ?? Date.now();
  const alerts: OperationsAlert[] = [];

  if (opts.restaurantOpen === false) {
    alerts.push({
      id: "restaurant-closed",
      type: "RESTAURANT_CLOSED",
      message: "Restaurante fechado — pedidos não estão sendo aceitos",
      severity: "warn",
      at: new Date(now).toISOString(),
    });
  }

  for (const c of cards) {
    const ageMin = (now - new Date(c.createdAt).getTime()) / 60000;

    if (!c.paymentApproved && c.status === "aguardando_pagamento" && ageMin > 10) {
      alerts.push({
        id: `pay-${c.id}`, type: "PAYMENT_PENDING",
        message: `Pagamento pendente • pedido ${c.number}`,
        severity: "warn", orderId: c.id, at: new Date(now).toISOString(),
      });
    }
    if (ageMin > LATE_THRESHOLD_MIN && !["entregue", "concluido", "cancelado"].includes(c.status)) {
      alerts.push({
        id: `late-${c.id}`, type: "LATE_ORDER",
        message: `Pedido ${c.number} atrasado (${Math.round(ageMin)}min)`,
        severity: "critical", orderId: c.id, at: new Date(now).toISOString(),
      });
    }
    if (c.status === "saiu_para_entrega" && c.etaMinutes && ageMin > c.etaMinutes + DRIVER_LATE_MIN) {
      alerts.push({
        id: `drv-${c.id}`, type: "DRIVER_LATE",
        message: `Entregador atrasado • pedido ${c.number}`,
        severity: "warn", orderId: c.id, at: new Date(now).toISOString(),
      });
    }
  }

  return alerts;
}
