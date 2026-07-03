import type { OperationsColumnId } from "./types";
import type { OrderState } from "@/lib/orders/OrderStateMachine";

export const OPERATIONS_COLUMNS: { id: OperationsColumnId; label: string; states: OrderState[] }[] = [
  { id: "NEW", label: "Novos", states: ["CREATED"] },
  { id: "WAITING_PAYMENT", label: "Aguardando pagamento", states: ["WAITING_PAYMENT"] },
  { id: "PAID", label: "Pagos", states: ["PAYMENT_APPROVED"] },
  { id: "ACCEPTED", label: "Aceitos", states: ["RESTAURANT_ACCEPTED"] },
  { id: "PREPARING", label: "Em preparo", states: ["PREPARING"] },
  { id: "READY", label: "Prontos", states: ["READY"] },
  { id: "DELIVERING", label: "Em entrega", states: ["OUT_FOR_DELIVERY"] },
  { id: "COMPLETED", label: "Finalizados", states: ["DELIVERED", "COMPLETED"] },
  { id: "CANCELLED", label: "Cancelados", states: ["CANCELLED", "REFUNDED", "RESTAURANT_REJECTED", "CHARGEBACK", "PAYMENT_FAILED"] },
];

export function columnForState(state: OrderState): OperationsColumnId {
  return OPERATIONS_COLUMNS.find((c) => c.states.includes(state))?.id ?? "NEW";
}
