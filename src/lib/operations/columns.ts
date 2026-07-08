import type { OperationsColumnId } from "./types";
import type { OrderState } from "@/lib/orders/OrderStateMachine";

export const OPERATIONS_COLUMNS: { id: OperationsColumnId; label: string; states: OrderState[] }[] = [
  { id: "NEW", label: "Novos", states: ["novo"] },
  { id: "aguardando_pagamento", label: "Aguardando pagamento", states: ["aguardando_pagamento"] },
  { id: "PAID", label: "Pagos", states: ["pago"] },
  { id: "ACCEPTED", label: "Aceitos", states: ["aceito"] },
  { id: "em_preparo", label: "Em preparo", states: ["em_preparo"] },
  { id: "pronto", label: "Prontos", states: ["pronto"] },
  { id: "DELIVERING", label: "Em entrega", states: ["saiu_para_entrega"] },
  { id: "concluido", label: "Finalizados", states: ["entregue", "concluido"] },
  { id: "cancelado", label: "Cancelados", states: ["cancelado", "reembolsado", "rejeitado", "chargeback", "falha_pagamento"] },
];

export function columnForState(state: OrderState): OperationsColumnId {
  return OPERATIONS_COLUMNS.find((c) => c.states.includes(state))?.id ?? "NEW";
}
