// OrderTimelineService — monta timeline legível a partir do histórico.
import type { StatusHistoryRow } from "./OrderOrchestrator";
import type { OrderState } from "./OrderStateMachine";

export interface TimelineEntry {
  at: string;
  status: OrderState;
  previousStatus: OrderState | null;
  label: string;
  reason: string | null;
  actorType: string;
}

const STATE_LABEL: Record<OrderState, string> = {
  novo: "Pedido criado",
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pagamento aprovado",
  falha_pagamento: "Pagamento recusado",
  aceito: "Restaurante aceitou",
  rejeitado: "Restaurante recusou",
  em_preparo: "Em preparo",
  pronto: "Pedido pronto",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  concluido: "Concluído",
  cancelado: "Cancelado",
  reembolsado: "Estornado",
  chargeback: "Chargeback",
};

export const OrderTimelineService = {
  build(history: StatusHistoryRow[]): TimelineEntry[] {
    return [...history]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((h) => ({
        at: h.created_at,
        status: h.current_status,
        previousStatus: h.previous_status,
        label: STATE_LABEL[h.current_status] ?? h.current_status,
        reason: h.reason,
        actorType: h.performed_by_type,
      }));
  },
};
