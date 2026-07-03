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
  CREATED: "Pedido criado",
  WAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PAYMENT_FAILED: "Pagamento recusado",
  RESTAURANT_ACCEPTED: "Restaurante aceitou",
  RESTAURANT_REJECTED: "Restaurante recusou",
  PREPARING: "Em preparo",
  READY: "Pedido pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
  CHARGEBACK: "Chargeback",
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
